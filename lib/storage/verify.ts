/**
 * Server-side magic-byte verification — Phase 6 · ADR-0021 § 2
 *
 * The commit endpoint reads the first ~16 bytes of a freshly-uploaded
 * staging object and runs them through `file-type` (npm, pure JS,
 * ~150 file types). The verified MIME is compared against the client's
 * declared MIME — mismatch is a hard reject.
 *
 * This module is the trust boundary for the CLAUDE.md hard rule
 * "Trust file extension — ตรวจ MIME magic bytes". Everything downstream
 * (R2 permanent key, FileAttachment.mimeType, Content-Type response
 * header) reads from the verified result, never from the declared MIME.
 */

import { fileTypeFromBuffer } from "file-type";
import {
  ALLOWED_MIME_TYPES,
  type AllowedMime,
} from "@/lib/assignment/constants";
import { ALLOWED_VERIFIED_EXTS, type VerifiedExt } from "./keys";

export type VerifyResult =
  | {
      ok: true;
      mime: AllowedMime;
      ext: VerifiedExt;
    }
  | {
      ok: false;
      reason:
        | "type_undetectable" // first bytes did not match any known signature
        | "mime_not_whitelisted" // detected MIME outside the allow-list
        | "mime_mismatch"; // detected MIME ≠ declared MIME
    };

/**
 * Run magic-byte detection over a buffer of bytes already fetched from
 * R2 staging. Returns a discriminated result — callers route each reason
 * into FILE_REJECTED audit category (ADR-0021 § 1 commit step 6).
 *
 * `declaredMime` is the MIME the client claimed at presign time
 * (recorded in the commit token). The function refuses to silently
 * accept the file with a corrected MIME (rejected alternative noted in
 * ADR-0021 § 2 — "no best-effort path").
 */
export async function verifyMagicBytes(args: {
  bytes: Uint8Array;
  declaredMime: string;
}): Promise<VerifyResult> {
  const detected = await fileTypeFromBuffer(args.bytes);
  if (!detected) {
    return { ok: false, reason: "type_undetectable" };
  }
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(detected.mime)) {
    return { ok: false, reason: "mime_not_whitelisted" };
  }
  if (detected.mime !== args.declaredMime) {
    return { ok: false, reason: "mime_mismatch" };
  }
  if (!(ALLOWED_VERIFIED_EXTS as readonly string[]).includes(detected.ext)) {
    // Defensive — file-type may evolve and emit an ext we have not
    // added to the verified allow-list. Treat as unknown.
    return { ok: false, reason: "mime_not_whitelisted" };
  }
  return {
    ok: true,
    mime: detected.mime as AllowedMime,
    ext: detected.ext as VerifiedExt,
  };
}
