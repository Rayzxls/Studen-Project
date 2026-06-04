/**
 * PURE R2 key generators + filename sanitisation — Phase 6 · ADR-0021 § 4
 *
 * Two key shapes:
 *
 *   staging/<uploaderId>/<uuid>
 *     Used during the upload window — presigned PUT lands here. A
 *     Cloudflare lifecycle rule on the `staging/` prefix reaps orphans
 *     after 24 h. The key carries no extension because magic-byte
 *     verification happens AFTER the bytes land.
 *
 *   permanent/<ownerType>/<ownerId>/<uuid>.<verifiedExt>
 *     Final resting place. The extension is the verified one from
 *     `file-type` magic-byte detection — never the user-supplied
 *     filename. CLAUDE.md § Hard Rules: "Trust file extension — ตรวจ
 *     MIME magic bytes" — the key encodes the verified type.
 *
 * Filename sanitisation is for `original_filename` (display only) and for
 * the RFC 5987 percent-encoded `Content-Disposition` header. The R2 key
 * itself never includes user-supplied bytes — it is uploaderId / ownerId /
 * UUID / extension only.
 *
 * No I/O. No env reads. Safe to import from anywhere.
 */

import { randomUUID } from "node:crypto";

/** ID safety — the harness already gives us cuid/UUID strings, but defend at the boundary. */
const SAFE_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

function assertSafeId(id: string, label: string): void {
  if (!SAFE_ID_RE.test(id)) {
    throw new Error(`${label}_invalid_id: ${JSON.stringify(id)}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Verified extension whitelist — mirrors ALLOWED_MIME_TYPES from
// lib/assignment/constants but expressed as the post-magic-byte
// extension that `file-type` returns.
// ─────────────────────────────────────────────────────────────

export const ALLOWED_VERIFIED_EXTS = [
  "pdf",
  "jpg", // file-type returns "jpg" for image/jpeg
  "png",
  "webp",
  "heic",
  "heif",
  "docx",
  "xlsx",
  "pptx",
] as const;

export type VerifiedExt = (typeof ALLOWED_VERIFIED_EXTS)[number];

export function isVerifiedExt(ext: string): ext is VerifiedExt {
  return (ALLOWED_VERIFIED_EXTS as readonly string[]).includes(ext);
}

// ─────────────────────────────────────────────────────────────
// Owner type — must match Prisma `FileOwnerType` enum literal-for-literal.
// Replicated here so this module stays @prisma/client-free (PURE-able).
// ─────────────────────────────────────────────────────────────

export const FILE_OWNER_TYPES = [
  "ASSIGNMENT",
  "MATERIAL",
  "ANNOUNCEMENT",
  "SUBMISSION",
  "COMMENT",
] as const;

export type FileOwnerTypeLiteral = (typeof FILE_OWNER_TYPES)[number];

export function isFileOwnerType(s: string): s is FileOwnerTypeLiteral {
  return (FILE_OWNER_TYPES as readonly string[]).includes(s);
}

// ─────────────────────────────────────────────────────────────
// Key generators
// ─────────────────────────────────────────────────────────────

/**
 * Build a staging key.
 *
 * The UUID is generated server-side and is the only entropy that survives
 * to the permanent key. Caller may pass an explicit UUID for deterministic
 * tests; production calls let the helper generate one.
 */
export function stagingKey(args: {
  uploaderId: string;
  uuid?: string;
}): string {
  assertSafeId(args.uploaderId, "uploaderId");
  const uuid = args.uuid ?? randomUUID();
  assertSafeId(uuid, "uuid");
  return `staging/${args.uploaderId}/${uuid}`;
}

/**
 * Build a permanent key from a verified MIME's extension.
 *
 * Caller is responsible for passing the verified extension (from
 * `file-type`). This function does not trust the caller — it asserts via
 * `isVerifiedExt` and throws on anything outside the allow-list.
 */
export function permanentKey(args: {
  ownerType: string;
  ownerId: string;
  uuid: string;
  verifiedExt: string;
}): string {
  if (!isFileOwnerType(args.ownerType)) {
    throw new Error(`owner_type_invalid: ${JSON.stringify(args.ownerType)}`);
  }
  assertSafeId(args.ownerId, "ownerId");
  assertSafeId(args.uuid, "uuid");
  if (!isVerifiedExt(args.verifiedExt)) {
    throw new Error(
      `verified_ext_invalid: ${JSON.stringify(args.verifiedExt)}`
    );
  }
  return `permanent/${args.ownerType}/${args.ownerId}/${args.uuid}.${args.verifiedExt}`;
}

// ─────────────────────────────────────────────────────────────
// Parsers — read back the structure when serving a download
// ─────────────────────────────────────────────────────────────

export interface ParsedStagingKey {
  kind: "staging";
  uploaderId: string;
  uuid: string;
}

export interface ParsedPermanentKey {
  kind: "permanent";
  ownerType: FileOwnerTypeLiteral;
  ownerId: string;
  uuid: string;
  verifiedExt: VerifiedExt;
}

export type ParsedR2Key = ParsedStagingKey | ParsedPermanentKey;

/**
 * Parse an R2 key back into its components. Returns `null` for any key
 * that does not match either of the two recognised shapes (no exceptions
 * — the caller decides whether an unrecognised key is a 404 or a 500).
 */
export function parseR2Key(key: string): ParsedR2Key | null {
  if (key.startsWith("staging/")) {
    // staging/<uploaderId>/<uuid>
    const parts = key.split("/");
    if (parts.length !== 3) return null;
    const [, uploaderId, uuid] = parts as [string, string, string];
    if (!SAFE_ID_RE.test(uploaderId) || !SAFE_ID_RE.test(uuid)) return null;
    return { kind: "staging", uploaderId, uuid };
  }
  if (key.startsWith("permanent/")) {
    // permanent/<ownerType>/<ownerId>/<uuid>.<verifiedExt>
    const parts = key.split("/");
    if (parts.length !== 4) return null;
    const [, ownerType, ownerId, terminal] = parts as [
      string,
      string,
      string,
      string,
    ];
    if (!isFileOwnerType(ownerType)) return null;
    if (!SAFE_ID_RE.test(ownerId)) return null;
    const dotIdx = terminal.lastIndexOf(".");
    if (dotIdx <= 0 || dotIdx === terminal.length - 1) return null;
    const uuid = terminal.slice(0, dotIdx);
    const ext = terminal.slice(dotIdx + 1);
    if (!SAFE_ID_RE.test(uuid)) return null;
    if (!isVerifiedExt(ext)) return null;
    return {
      kind: "permanent",
      ownerType,
      ownerId,
      uuid,
      verifiedExt: ext,
    };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Filename sanitisation
// ─────────────────────────────────────────────────────────────

/**
 * Strip control characters and path separators from a display filename.
 *
 * The result is safe to render in HTML (no NUL, no CR/LF) and safe to
 * pass as the `filename` parameter of an ASCII `Content-Disposition`
 * header — for full Unicode header rendering, additionally percent-
 * encode via `encodeURIComponent` at the response edge.
 *
 * Caps at 255 characters (filesystem-conservative; R2 doesn't care, but
 * 255 is the common downstream limit).
 */
export function sanitiseDisplayFilename(name: string): string {
  // Strip non-printable control chars EXCEPT tab (tab is treated as
  // whitespace in the next step) and path separators.
  let cleaned = name.replace(/[\x00-\x08\x0a-\x1f\x7f/\\]/g, "");
  // Collapse whitespace runs (including tabs and multiple spaces).
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  // Strip leading dots — hidden-file convention + path-traversal residue
  // (`.gitignore` is not in our MIME allow-list, so the loss is acceptable).
  cleaned = cleaned.replace(/^\.+/, "");
  // Pathological fallback.
  if (cleaned === "" || cleaned === "." || cleaned === "..") {
    cleaned = "untitled";
  }
  return cleaned.slice(0, 255);
}

/**
 * Build an RFC 5987 + RFC 6266 compliant `Content-Disposition` value.
 *
 * Emits BOTH the ASCII `filename=` (fallback for ancient clients) AND
 * the UTF-8 `filename*=UTF-8''...` (RFC 5987 percent-encoded). Modern
 * browsers prefer the UTF-8 variant; Thai filenames render correctly.
 *
 *   inline   for image/PDF preview
 *   attachment for office docs (force download)
 *
 * (ADR-0021 § 6 — per-MIME Content-Disposition policy.)
 */
export function buildContentDisposition(args: {
  filename: string;
  disposition: "inline" | "attachment";
}): string {
  const safe = sanitiseDisplayFilename(args.filename);
  const asciiFallback = safe.replace(/[^\x20-\x7e]/g, "_");
  const utf8Encoded = encodeURIComponent(safe);
  return `${args.disposition}; filename="${asciiFallback}"; filename*=UTF-8''${utf8Encoded}`;
}
