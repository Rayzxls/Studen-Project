/**
 * Image re-encode + EXIF strip — Phase 6 · ADR-0021 § 5
 *
 * Runs at commit-time on JPEG / PNG / HEIC / HEIF bytes after magic-byte
 * verification. `sharp` re-encodes the image, which:
 *   - strips EXIF (including GPS coordinates — PDPA-relevant for student
 *     photo uploads); sharp's default `toBuffer()` does NOT carry
 *     metadata unless `.withMetadata()` is explicitly called;
 *   - normalises orientation via `.rotate()` (reads EXIF orientation,
 *     applies rotation, then drops the tag);
 *   - transcodes HEIC / HEIF → JPEG (universal browser support; iPhone
 *     uploads land as JPEG in R2 regardless of source format).
 *
 * Non-image MIMEs pass through untouched — PDF / WEBP / DOCX / XLSX /
 * PPTX. PDF metadata stripping is heavier than the gain warrants
 * (ADR-0021 § 5 Negative). WEBP per the school-use spec does not carry
 * GPS EXIF natively.
 *
 * The return value is the bytes that get written to the permanent key
 * + the final (post-transcode) MIME + verified extension.
 */

import sharp from "sharp";
import type { AllowedMime } from "@/lib/assignment/constants";
import type { VerifiedExt } from "./keys";

/**
 * sharp's default `failOn: "warning"` promotes libjpeg/libvips *warnings*
 * (e.g. "VipsJpeg: Invalid SOS parameters for sequential JPEG") to thrown
 * errors. Browser-canvas JPEGs (the avatar crop ships `canvas.toBlob`
 * output) and phone exports routinely carry such warning-level quirks, and
 * the libvips build on Vercel is stricter than typical dev machines — so a
 * commit that works locally 500s in production. We re-encode every image
 * anyway, so decode defensively and let the clean re-encode fix the bytes.
 */
const SHARP_OPTS = { failOn: "none" } as const;

export interface ProcessImageResult {
  bytes: Buffer;
  finalMime: AllowedMime;
  finalExt: VerifiedExt;
}

/**
 * Process a verified upload's bytes for storage.
 *
 * Inputs:
 *   bytes — raw uploaded bytes (already magic-byte verified).
 *   verifiedMime — the trusted MIME from `verifyMagicBytes`.
 *   verifiedExt  — the trusted extension from `verifyMagicBytes`.
 *
 * Output:
 *   bytes      — the bytes to write to permanent/ (may differ from input
 *                when re-encode happened).
 *   finalMime  — the MIME for FileAttachment.mimeType + Content-Type
 *                response (transcode collapses HEIC → image/jpeg).
 *   finalExt   — the extension for the permanent R2 key.
 */
export async function processImageForStorage(args: {
  bytes: Uint8Array;
  verifiedMime: AllowedMime;
  verifiedExt: VerifiedExt;
}): Promise<ProcessImageResult> {
  const input = Buffer.from(args.bytes);

  switch (args.verifiedMime) {
    case "image/jpeg": {
      const out = await sharp(input, SHARP_OPTS)
        .rotate()
        .jpeg({ quality: 85 })
        .toBuffer();
      return { bytes: out, finalMime: "image/jpeg", finalExt: "jpg" };
    }
    case "image/png": {
      const out = await sharp(input, SHARP_OPTS)
        .rotate()
        .png({ compressionLevel: 9 })
        .toBuffer();
      return { bytes: out, finalMime: "image/png", finalExt: "png" };
    }
    case "image/heic":
    case "image/heif": {
      // Transcode to JPEG — universal browser support.
      const out = await sharp(input, SHARP_OPTS)
        .rotate()
        .jpeg({ quality: 85 })
        .toBuffer();
      return { bytes: out, finalMime: "image/jpeg", finalExt: "jpg" };
    }
    case "image/webp":
    case "application/pdf":
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      // Pass through unchanged. No EXIF concern (WEBP per school-use spec
      // does not carry GPS; PDF metadata is left intact per ADR-0021 § 5
      // Negative — re-encode cost exceeds the gain at the Phase 6 threat
      // model).
      return {
        bytes: input,
        finalMime: args.verifiedMime,
        finalExt: args.verifiedExt,
      };
  }
}
