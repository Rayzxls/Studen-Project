import { NextResponse } from "next/server";
import { z } from "zod";
import type { FileOwnerType } from "@prisma/client";
import { assert, requireAuth } from "@/lib/auth/guards";
import { commitUpload } from "@/lib/storage/commit";
import {
  commitLocalUpload,
  isLocalStorageFallbackEnabled,
} from "@/lib/storage/local-dev";
import { verifyCommitToken } from "@/lib/storage/jwt";
import { isFileOwnerType } from "@/lib/storage/keys";
import { getRequestMeta } from "@/lib/utils/request";
import { errorResponse, ValidationError } from "@/lib/errors";

const CommitBodySchema = z.object({
  commitToken: z.string().min(1),
  originalFilename: z.string().trim().min(1).max(255),
});

/**
 * POST /api/storage/commit — Phase 6 · ADR-0021 § 1 step 3
 *
 * Body: { commitToken, originalFilename }
 * Returns: { fileId }
 *
 * The token already binds the original (ownerType, ownerId, uploaderId) at
 * presign time, so the client cannot retarget the upload. We still re-run
 * `assert.canUploadTo` here against the verified payload (Q9.3 grill —
 * TOCTOU defence: a teacher who lost access to the course between presign
 * and commit must fail the commit even though the token would otherwise
 * be valid).
 *
 * Auth is checked BEFORE token verification so anonymous probes do not
 * fingerprint the JWT layer — they get 401, never 400.
 */
export async function POST(req: Request) {
  try {
    // Auth-first — anonymous always gets 401 regardless of body shape.
    await requireAuth();

    const meta = await getRequestMeta();
    const parsed = CommitBodySchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new ValidationError(
        Object.fromEntries(
          parsed.error.issues.map((i) => [i.path.join(".") || "_", i.message])
        )
      );
    }

    const secret = process.env.AUTH_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "server_misconfigured" },
        { status: 500 }
      );
    }

    // Peek the token to recover (ownerType, ownerId) for the re-authz check.
    // commitUpload re-verifies the token (signature + expiry + uid match) on
    // its own, so this is a pure read — no trust placed in the result beyond
    // routing the assert call.
    const verified = verifyCommitToken({
      token: parsed.data.commitToken,
      secret,
      nowMs: Date.now(),
    });
    if (!verified.ok) {
      throw new ValidationError({
        commitToken: `token_${verified.reason}`,
      });
    }

    // The token's oTy is typed as `string` at the JWT layer (schema-
    // decoupled by design). Narrow to the Prisma enum before authz —
    // anything outside the allow-list is a signed-but-malformed token,
    // which is treated as a verification failure.
    if (!isFileOwnerType(verified.payload.oTy)) {
      throw new ValidationError({ commitToken: "token_payload_invalid" });
    }

    // TOCTOU re-check: did the actor still own the upload scope at commit
    // time? Throws Forbidden / NotFound that errorResponse maps to 403 / 404.
    const session = await assert.canUploadTo(
      verified.payload.oTy as FileOwnerType,
      verified.payload.oId
    );

    const commit = isLocalStorageFallbackEnabled()
      ? commitLocalUpload
      : commitUpload;

    const result = await commit(
      { commitToken: parsed.data.commitToken },
      {
        actorUserId: session.user.id,
        originalFilename: parsed.data.originalFilename,
        secret,
        nowMs: Date.now(),
        ipAddress: meta.ipAddress ?? undefined,
        userAgent: meta.userAgent ?? undefined,
      }
    );

    return NextResponse.json(result);
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
