/**
 * Commit orchestration — Phase 6 · ADR-0021 § 1 step 3
 *
 * Called from the `/api/storage/commit` API route after the client has
 * successfully PUT bytes to the staging key. In one call:
 *
 *   1. Verify the commit token (HMAC signature + expiry + actor match).
 *   2. Fetch the staging object from R2 (GetObject).
 *   3. Run magic-byte verification on the bytes.
 *   4. Re-encode + EXIF-strip images via `processImageForStorage`.
 *   5. Build the permanent key and upload the processed bytes.
 *   6. Delete the staging object (idempotent — best-effort).
 *   7. Insert a FileAttachment row + fire FILE_UPLOADED audit (Important).
 *
 * Any verification / processing failure:
 *   • Attempt staging cleanup (best-effort — R2 lifecycle rule reaps in
 *     24 h regardless).
 *   • Fire FILE_REJECTED audit (Important) with the categorical reason.
 *   • Throw `ValidationError` so the API route returns 400.
 */

import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import type { FileAttachment } from "@prisma/client";
import { audit } from "@/lib/audit/log";
import { db } from "@/lib/db/client";
import { Forbidden, ValidationError } from "@/lib/errors";
import { TX_OPTS } from "@/lib/assignment/constants";
import { processImageForStorage } from "./image";
import { permanentKey, sanitiseDisplayFilename } from "./keys";
import { verifyCommitToken } from "./jwt";
import { getR2Bucket, getR2Client } from "./r2-client";
import { verifyMagicBytes } from "./verify";

export interface CommitContext {
  /** Authenticated User.id of the uploader — must match the token's `uid`. */
  actorUserId: string;
  /** Original filename from the presign payload (for FileAttachment.originalFilename). */
  originalFilename: string;
  /** HMAC secret (production: process.env.AUTH_SECRET). */
  secret: string;
  /** Injectable clock; production: `Date.now()`. */
  nowMs: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface CommitResult {
  fileId: string;
}

export async function commitUpload(
  args: { commitToken: string },
  ctx: CommitContext
): Promise<CommitResult> {
  // 1. Verify token.
  const verified = verifyCommitToken({
    token: args.commitToken,
    secret: ctx.secret,
    nowMs: ctx.nowMs,
  });
  if (!verified.ok) {
    // No audit yet — we have no validated actor/owner pair to attribute
    // the rejection to. The HTTP boundary surfaces the categorical reason.
    throw new ValidationError({ commitToken: `token_${verified.reason}` });
  }
  const { payload } = verified;

  if (payload.uid !== ctx.actorUserId) {
    throw new Forbidden("commit_token_actor_mismatch");
  }

  const r2 = getR2Client();
  const bucket = getR2Bucket();

  // 2. Fetch the staging bytes.
  const stagingBytes = await fetchObjectBytes(bucket, payload.stg);

  // 3. Magic-byte verification.
  const verifyResult = await verifyMagicBytes({
    bytes: stagingBytes,
    declaredMime: payload.dMt,
  });
  if (!verifyResult.ok) {
    await tryDeleteStaging(bucket, payload.stg);
    await audit({
      actorId: ctx.actorUserId,
      actorRole: null, // resolved at API route from session; unknown here
      action: "FILE_REJECTED",
      targetType: payload.oTy,
      targetId: payload.oId,
      reason: verifyResult.reason,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      after: {
        declaredMime: payload.dMt,
        declaredSize: payload.dSz,
      },
    });
    throw new ValidationError({ commitToken: verifyResult.reason });
  }

  // 4. Image re-encode + EXIF strip (no-op for PDF / office docs / WEBP).
  const processed = await processImageForStorage({
    bytes: stagingBytes,
    verifiedMime: verifyResult.mime,
    verifiedExt: verifyResult.ext,
  });

  // 5. Upload to permanent key.
  const finalUuid = randomUUID();
  const finalKey = permanentKey({
    ownerType: payload.oTy,
    ownerId: payload.oId,
    uuid: finalUuid,
    verifiedExt: processed.finalExt,
  });
  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: finalKey,
      Body: processed.bytes,
      ContentType: processed.finalMime,
    })
  );

  // 6. Delete staging — best-effort.
  await tryDeleteStaging(bucket, payload.stg);

  // 7. Insert FileAttachment + audit in one tx.
  const sanitisedFilename = sanitiseDisplayFilename(ctx.originalFilename);
  let row: FileAttachment;
  try {
    row = await db.$transaction(async (tx) => {
      const created = await tx.fileAttachment.create({
        data: {
          r2Key: finalKey,
          originalFilename: sanitisedFilename,
          mimeType: processed.finalMime,
          sizeBytes: processed.bytes.length,
          ownerType: payload.oTy as FileAttachment["ownerType"],
          ownerId: payload.oId,
          uploadedById: ctx.actorUserId,
        },
      });
      await audit(
        {
          actorId: ctx.actorUserId,
          actorRole: null,
          action: "FILE_UPLOADED",
          targetType: "FileAttachment",
          targetId: created.id,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          after: {
            ownerType: created.ownerType,
            ownerId: created.ownerId,
            mimeType: created.mimeType,
            sizeBytes: created.sizeBytes,
          },
        },
        tx
      );
      return created;
    }, TX_OPTS);
  } catch (err) {
    // If the DB insert fails after permanent upload, attempt to clean
    // up the permanent object so we do not leave a billable orphan.
    await tryDeletePermanent(bucket, finalKey);
    throw err;
  }

  return { fileId: row.id };
}

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

/**
 * Fetch the full body of an R2 object as a single Buffer.
 *
 * We need the whole file in memory anyway (magic-byte verify + image
 * re-encode both want bytes). 20 MB cap on input keeps this within
 * Vercel function memory limits (ADR-0021 § Positive).
 */
async function fetchObjectBytes(bucket: string, key: string): Promise<Buffer> {
  const r2 = getR2Client();
  const resp = await r2.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );
  if (!resp.Body) {
    throw new ValidationError({ commitToken: "staging_object_missing" });
  }
  const chunks: Buffer[] = [];
  // Body is a Node stream (Readable) in the Node SDK runtime.
  const stream = resp.Body as NodeJS.ReadableStream;
  for await (const chunk of stream) {
    chunks.push(
      typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk)
    );
  }
  return Buffer.concat(chunks);
}

async function tryDeleteStaging(bucket: string, key: string): Promise<void> {
  try {
    await getR2Client().send(
      new DeleteObjectCommand({ Bucket: bucket, Key: key })
    );
  } catch {
    // Best-effort — R2 lifecycle reaps stale staging keys after 24 h.
  }
}

async function tryDeletePermanent(bucket: string, key: string): Promise<void> {
  try {
    await getR2Client().send(
      new DeleteObjectCommand({ Bucket: bucket, Key: key })
    );
  } catch {
    // Best-effort cleanup on the rare DB-insert-after-upload failure.
    // The orphan is identifiable because no FileAttachment row points
    // at it; Phase 9 hardening can add a reconciler if this matters.
  }
}
