/**
 * Presign orchestration — Phase 6 · ADR-0021 § 1 step 1
 *
 * Wraps the R2 sign helper + commit-token signer into the single call
 * the `/api/storage/presign` route makes:
 *
 *   1. Validate the input shape (Zod via PresignUploadSchema — already
 *      caps size, mime, filename).
 *   2. Permission check — defers to the caller via the `canUpload`
 *      predicate. We do not encode Assignment / Submission / Comment
 *      ownership rules here because those live in lib/auth + lib/assignment.
 *      Pattern 1 separation: lib/storage stays I/O-only, lib/auth holds
 *      the predicates.
 *   3. Build a staging key (lib/storage/keys.stagingKey) using a fresh
 *      UUID; this is the key R2 stores under for the next ~5 min.
 *   4. Sign the R2 PUT URL (5-min TTL).
 *   5. Sign the commit token (10-min TTL — longer than the upload TTL so
 *      a 20 MB upload that finishes near the URL deadline still has time
 *      to call /commit).
 *   6. Return both — client PUTs file to `uploadUrl`, then POSTs
 *      `commitToken` to `/api/storage/commit`.
 *
 * Production wrapper at the API-route boundary reads AUTH_SECRET from
 * env and passes it in. This function stays env-agnostic so it can be
 * exercised by integration tests with deterministic secrets.
 */

import {
  PresignUploadSchema,
  type PresignUploadInput,
} from "@/lib/assignment/validation";
import { stagingKey } from "./keys";
import { signCommitToken } from "./jwt";
import { signUploadUrl } from "./sign";
import { Forbidden } from "@/lib/errors";

export interface PresignContext {
  /** Authenticated User.id of the uploader. */
  actorUserId: string;
  /** Owner-scope authz check — async to allow DB lookups (Assignment.teacherId, Submission.studentId, etc.). */
  canUpload: (args: {
    ownerType: PresignUploadInput["ownerType"];
    ownerId: string;
    actorUserId: string;
  }) => Promise<boolean>;
  /** HMAC secret for the commit token (production: process.env.AUTH_SECRET). */
  secret: string;
  /** Injectable clock for deterministic tests; production passes `Date.now()`. */
  nowMs: number;
  /** Commit-token TTL in ms. Production: 600_000 (10 min). */
  commitTokenTtlMs?: number;
}

export interface PresignResult {
  uploadUrl: string;
  commitToken: string;
  stagingKey: string;
}

const DEFAULT_COMMIT_TOKEN_TTL_MS = 600_000; // 10 min

export async function presignUpload(
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
  const uploadUrl = await signUploadUrl({
    stagingKey: key,
    declaredMime: parsed.declaredMime,
    declaredSize: parsed.declaredSize,
  });

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

  return { uploadUrl, commitToken, stagingKey: key };
}
