import { NextResponse } from "next/server";
import { assert } from "@/lib/auth/guards";
import { PresignUploadSchema } from "@/lib/assignment/validation";
import { presignUpload } from "@/lib/storage/presign";
import { errorResponse, ValidationError } from "@/lib/errors";

/**
 * POST /api/storage/presign — Phase 6 · ADR-0021 § 1 step 1
 *
 * Body shape (Zod-validated):
 *   {
 *     ownerType: "ASSIGNMENT" | "SUBMISSION",  // P7-0b
 *     ownerId: string,
 *     declaredMime: <allow-list MIME>,
 *     declaredSize: number (≤ 20_971_520),
 *     originalFilename: string,
 *   }
 *
 * Returns: { uploadUrl, commitToken, stagingKey }
 *
 * The authz dispatch happens twice — once here (assert.canUploadTo runs
 * the DB-backed owner-scope check before the staging URL is signed) and
 * once again in /commit (TOCTOU defence per Q9.3 grill).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as unknown;
    const parsed = PresignUploadSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        Object.fromEntries(
          parsed.error.issues.map((i) => [i.path.join(".") || "_", i.message])
        )
      );
    }

    const session = await assert.canUploadTo(
      parsed.data.ownerType,
      parsed.data.ownerId
    );

    const secret = process.env.AUTH_SECRET;
    if (!secret) {
      // Hard fail at the boundary — never sign with a fallback secret.
      return NextResponse.json(
        { error: "server_misconfigured" },
        { status: 500 }
      );
    }

    const result = await presignUpload(parsed.data, {
      actorUserId: session.user.id,
      // Inner predicate is a no-op because assert.canUploadTo already ran;
      // presignUpload still calls it for unit-test symmetry, so return true.
      canUpload: async () => true,
      secret,
      nowMs: Date.now(),
    });

    return NextResponse.json(result);
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
