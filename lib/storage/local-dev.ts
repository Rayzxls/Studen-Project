import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FileAttachment } from "@prisma/client";
import { audit } from "@/lib/audit/log";
import { TX_OPTS } from "@/lib/assignment/constants";
import {
  PresignUploadSchema,
  type PresignUploadInput,
} from "@/lib/assignment/validation";
import { db } from "@/lib/db/client";
import { Forbidden, ValidationError } from "@/lib/errors";
import { processImageForStorage } from "./image";
import { signCommitToken, verifyCommitToken } from "./jwt";
import {
  parseR2Key,
  permanentKey,
  sanitiseDisplayFilename,
  stagingKey,
} from "./keys";
import type { CommitContext, CommitResult } from "./commit";
import type { PresignContext, PresignResult } from "./presign";
import { verifyMagicBytes } from "./verify";

const LOCAL_STORAGE_DIR = ".local-storage";
const DEFAULT_COMMIT_TOKEN_TTL_MS = 600_000;

export function hasR2StorageEnv(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

export function isLocalStorageFallbackEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && !hasR2StorageEnv();
}

export async function presignLocalUpload(
  input: PresignUploadInput,
  ctx: PresignContext
): Promise<PresignResult> {
  const parsed = PresignUploadSchema.parse(input);

  const allowed = await ctx.canUpload({
    ownerType: parsed.ownerType,
    ownerId: parsed.ownerId,
    actorUserId: ctx.actorUserId,
  });
  if (!allowed) throw new Forbidden("not_allowed_to_upload_here");

  const key = stagingKey({ uploaderId: ctx.actorUserId });
  const commitToken = signCommitToken({
    payload: {
      stg: key,
      uid: ctx.actorUserId,
      oTy: parsed.ownerType,
      oId: parsed.ownerId,
      dMt: parsed.declaredMime,
      dSz: parsed.declaredSize,
    },
    secret: ctx.secret,
    nowMs: ctx.nowMs,
    ttlMs: ctx.commitTokenTtlMs ?? DEFAULT_COMMIT_TOKEN_TTL_MS,
  });

  return {
    uploadUrl: `/api/storage/local-upload?token=${encodeURIComponent(
      commitToken
    )}`,
    commitToken,
    stagingKey: key,
  };
}

export async function writeLocalObject(
  key: string,
  bytes: Uint8Array
): Promise<void> {
  const target = localObjectPath(key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
}

export async function readLocalObject(key: string): Promise<Buffer> {
  try {
    return await readFile(localObjectPath(key));
  } catch {
    throw new ValidationError({ commitToken: "staging_object_missing" });
  }
}

export async function deleteLocalObject(key: string): Promise<void> {
  try {
    await unlink(localObjectPath(key));
  } catch {
    // Best-effort cleanup, same posture as R2 staging cleanup.
  }
}

export async function commitLocalUpload(
  args: { commitToken: string },
  ctx: CommitContext
): Promise<CommitResult> {
  const verified = verifyCommitToken({
    token: args.commitToken,
    secret: ctx.secret,
    nowMs: ctx.nowMs,
  });
  if (!verified.ok) {
    throw new ValidationError({ commitToken: `token_${verified.reason}` });
  }
  const { payload } = verified;

  if (payload.uid !== ctx.actorUserId) {
    throw new Forbidden("commit_token_actor_mismatch");
  }

  const stagingBytes = await readLocalObject(payload.stg);
  const verifyResult = await verifyMagicBytes({
    bytes: stagingBytes,
    declaredMime: payload.dMt,
  });
  if (!verifyResult.ok) {
    await deleteLocalObject(payload.stg);
    await audit({
      actorId: ctx.actorUserId,
      actorRole: null,
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

  const processed = await processImageForStorage({
    bytes: stagingBytes,
    verifiedMime: verifyResult.mime,
    verifiedExt: verifyResult.ext,
  });

  const finalUuid = randomUUID();
  const finalKey = permanentKey({
    ownerType: payload.oTy,
    ownerId: payload.oId,
    uuid: finalUuid,
    verifiedExt: processed.finalExt,
  });
  await writeLocalObject(finalKey, processed.bytes);
  await deleteLocalObject(payload.stg);

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
    await deleteLocalObject(finalKey);
    throw err;
  }

  return { fileId: row.id };
}

function localObjectPath(key: string): string {
  const parsed = parseR2Key(key);
  if (!parsed) {
    throw new ValidationError({ commitToken: "storage_key_invalid" });
  }

  const root = path.resolve(process.cwd(), LOCAL_STORAGE_DIR);
  const target = path.resolve(root, ...key.split("/"));
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new ValidationError({ commitToken: "storage_key_invalid" });
  }
  return target;
}
