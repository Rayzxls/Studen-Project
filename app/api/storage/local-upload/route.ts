import { NextResponse } from "next/server";
import { ValidationError, errorResponse, NotFound } from "@/lib/errors";
import { verifyCommitToken } from "@/lib/storage/jwt";
import { parseR2Key } from "@/lib/storage/keys";
import {
  isLocalStorageFallbackEnabled,
  writeLocalObject,
} from "@/lib/storage/local-dev";

export const runtime = "nodejs";

/**
 * Local-dev replacement for the R2 presigned PUT URL.
 *
 * Enabled only when NODE_ENV !== "production" and R2 env is missing. The
 * signed commit token still binds uploader, owner, MIME, size and staging key,
 * so the browser upload contract stays the same as production.
 */
export async function PUT(req: Request) {
  try {
    if (!isLocalStorageFallbackEnabled()) {
      throw new NotFound("local_upload_disabled");
    }

    const token = new URL(req.url).searchParams.get("token");
    if (!token) {
      throw new ValidationError({ commitToken: "token_missing" });
    }

    const secret = process.env.AUTH_SECRET;
    if (!secret) {
      return NextResponse.json(
        {
          error: {
            code: "server_misconfigured",
            message: "server_misconfigured",
          },
        },
        { status: 500 }
      );
    }

    const verified = verifyCommitToken({
      token,
      secret,
      nowMs: Date.now(),
    });
    if (!verified.ok) {
      throw new ValidationError({ commitToken: `token_${verified.reason}` });
    }

    const staging = parseR2Key(verified.payload.stg);
    if (
      staging?.kind !== "staging" ||
      staging.uploaderId !== verified.payload.uid
    ) {
      throw new ValidationError({ commitToken: "token_payload_invalid" });
    }

    const requestMime = req.headers
      .get("content-type")
      ?.split(";")[0]
      .trim()
      .toLowerCase();
    if (requestMime && requestMime !== verified.payload.dMt) {
      throw new ValidationError({ declaredMime: "mime_mismatch" });
    }

    const bytes = Buffer.from(await req.arrayBuffer());
    if (bytes.length !== verified.payload.dSz) {
      throw new ValidationError({ declaredSize: "size_mismatch" });
    }

    await writeLocalObject(verified.payload.stg, bytes);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
