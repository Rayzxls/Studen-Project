/**
 * Presigned URL helpers — Phase 6 · ADR-0021 § 1, § 6
 *
 *   signUploadUrl       — presigned PUT into staging/. 5-min TTL per
 *                         CLAUDE.md hard rule.
 *   signDownloadUrl     — presigned GET with Content-Disposition override.
 *                         5-min TTL. Server emits a 302 to this URL via
 *                         the click-time route OR embeds it directly in
 *                         the page HTML for inline preview (ADR-0021 § 6
 *                         hybrid strategy).
 *
 * The CLAUDE.md hard rule "ห้าม log signed URL" applies — these helpers
 * return the URL to the caller without logging. The audit family
 * (FILE_UPLOADED / FILE_REJECTED / FILE_DELETED) covers the lifecycle
 * mutations; per-fetch access is NOT audited in Phase 6 (ADR-0021 § 6).
 */

import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Bucket, getR2Client } from "./r2-client";

/**
 * 5-min TTL per CLAUDE.md hard rule.
 * Exported so the presign / download API routes pass the same number
 * into both R2 and the response cache-control headers, keeping them
 * in lock-step.
 */
export const SIGNED_URL_TTL_SEC = 300;

// ─────────────────────────────────────────────────────────────
// Upload — presigned PUT into staging/
// ─────────────────────────────────────────────────────────────

/**
 * Build a presigned PUT URL into the R2 staging prefix.
 *
 * `declaredMime` is set as `Content-Type` on the request — S3 will reject
 * the PUT if the client sends a different Content-Type. The actual MIME
 * verification still happens server-side after the PUT lands
 * (file-type magic-byte), but pinning Content-Type here gives a fast
 * fail at upload time when the client lies about the type.
 *
 * `declaredSize` is set as `ContentLength` — S3 rejects a PUT whose body
 * size does not match. Defends against partial upload + multi-MB
 * mismatches before the body even hits the bucket.
 */
export async function signUploadUrl(args: {
  stagingKey: string;
  declaredMime: string;
  declaredSize: number;
}): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: getR2Bucket(),
    Key: args.stagingKey,
    ContentType: args.declaredMime,
    ContentLength: args.declaredSize,
  });
  return getSignedUrl(getR2Client(), cmd, {
    expiresIn: SIGNED_URL_TTL_SEC,
  });
}

// ─────────────────────────────────────────────────────────────
// Download — presigned GET with Content-Disposition override
// ─────────────────────────────────────────────────────────────

/**
 * Build a presigned GET URL for a permanent-prefix object.
 *
 * `contentDisposition` should be the value built by
 * `lib/storage/keys.buildContentDisposition()` — pre-sanitised filename
 * + per-MIME inline/attachment per ADR-0021 § 6.
 *
 * R2 honors the `response-content-disposition` query parameter as a
 * per-request override of the stored object metadata, so the same
 * permanent key can serve both inline preview (image/PDF) and attachment
 * download (office docs) depending on which signing path the caller
 * chose.
 */
export async function signDownloadUrl(args: {
  permanentKey: string;
  contentDisposition: string;
}): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: getR2Bucket(),
    Key: args.permanentKey,
    ResponseContentDisposition: args.contentDisposition,
  });
  return getSignedUrl(getR2Client(), cmd, {
    expiresIn: SIGNED_URL_TTL_SEC,
  });
}
