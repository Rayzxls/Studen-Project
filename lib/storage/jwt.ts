/**
 * Commit-token sign + verify — Phase 6 · ADR-0021 § 1
 *
 * The presign endpoint returns the client a short-lived `commitToken`
 * that encodes the staging key + intended owner so the commit endpoint
 * can validate "this client really did just upload to this exact
 * staging location for this exact owner" without a database round-trip
 * on every commit.
 *
 * Implementation:
 *   - Standard JWT shape (`header.payload.signature`).
 *   - HS256 (HMAC-SHA256) via `node:crypto` — no external deps. The
 *     algorithm is locked at sign + verify; this module refuses any
 *     other `alg` value at parse time (algorithm-confusion guard).
 *   - All base64 encoding is URL-safe (RFC 4648 § 5) without padding.
 *   - Payload fields use the standard `exp` (seconds since epoch) so
 *     the row stays inspectable with any off-the-shelf JWT decoder
 *     during forensic work.
 *
 * Caller passes the secret + clock. No env reads here — keep the module
 * pure for testability. The API-route wrapper reads `AUTH_SECRET` from
 * env.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export interface CommitTokenPayload {
  /** R2 staging key. */
  stg: string;
  /** Uploader User.id — must equal the actor on commit. */
  uid: string;
  /** Intended owner type (Prisma enum literal). */
  oTy: string;
  /** Intended owner id. */
  oId: string;
  /** Declared MIME (presign-time hint; magic-byte verify happens later). */
  dMt: string;
  /** Declared size in bytes. */
  dSz: number;
  /** Standard JWT exp — seconds since epoch. Issuer fills this in. */
  exp: number;
}

const HEADER_OBJ = { alg: "HS256", typ: "JWT" } as const;
const HEADER_B64 = base64urlEncode(Buffer.from(JSON.stringify(HEADER_OBJ)));

// ─────────────────────────────────────────────────────────────
// sign / verify
// ─────────────────────────────────────────────────────────────

/**
 * Sign a commit-token payload. Caller injects the secret + an explicit
 * `now` for deterministic tests; production code passes `Date.now()`.
 *
 * `ttlMs` is the lifetime — 10 min matches ADR-0021 § 1 (long enough to
 * cover a 20 MB upload over 3G + the commit round-trip).
 */
export function signCommitToken(args: {
  payload: Omit<CommitTokenPayload, "exp">;
  secret: string;
  nowMs: number;
  ttlMs: number;
}): string {
  if (args.secret.length === 0) {
    throw new Error("commit_token_secret_required");
  }
  const exp = Math.floor((args.nowMs + args.ttlMs) / 1000);
  const full: CommitTokenPayload = { ...args.payload, exp };
  const payloadB64 = base64urlEncode(Buffer.from(JSON.stringify(full)));
  const signingInput = `${HEADER_B64}.${payloadB64}`;
  const sig = base64urlEncode(
    createHmac("sha256", args.secret).update(signingInput).digest()
  );
  return `${signingInput}.${sig}`;
}

export type VerifyCommitTokenResult =
  | { ok: true; payload: CommitTokenPayload }
  | {
      ok: false;
      reason:
        | "malformed"
        | "header_invalid"
        | "alg_mismatch"
        | "signature_invalid"
        | "payload_invalid"
        | "expired";
    };

/**
 * Verify a commit-token. Returns a discriminated result rather than
 * throwing — callers route the failure reason into a specific HTTP
 * status / audit category.
 *
 * Constant-time signature compare via `crypto.timingSafeEqual` —
 * defends against timing-oracle attacks even though the upstream attack
 * surface is small.
 */
export function verifyCommitToken(args: {
  token: string;
  secret: string;
  nowMs: number;
}): VerifyCommitTokenResult {
  if (args.secret.length === 0) {
    throw new Error("commit_token_secret_required");
  }
  const parts = args.token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

  // Header — must be the canonical {alg:"HS256",typ:"JWT"} we emitted.
  // We compare against our own canonical encoding rather than re-parsing
  // arbitrary JSON, which closes the alg-confusion door entirely.
  if (headerB64 !== HEADER_B64) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(base64urlDecode(headerB64).toString("utf8"));
    } catch {
      return { ok: false, reason: "header_invalid" };
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed as { alg?: unknown }).alg !== "HS256"
    ) {
      return { ok: false, reason: "alg_mismatch" };
    }
    // Header was structurally fine but did not byte-match our canonical
    // shape (e.g. different key order). Refuse — we only sign one shape,
    // anything else is a tampering signal.
    return { ok: false, reason: "header_invalid" };
  }

  // Signature — constant-time.
  const expectedSig = base64urlEncode(
    createHmac("sha256", args.secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest()
  );
  if (!constantTimeEqual(sigB64, expectedSig)) {
    return { ok: false, reason: "signature_invalid" };
  }

  // Payload shape.
  let payload: unknown;
  try {
    payload = JSON.parse(base64urlDecode(payloadB64).toString("utf8"));
  } catch {
    return { ok: false, reason: "payload_invalid" };
  }
  if (!isCommitTokenPayload(payload)) {
    return { ok: false, reason: "payload_invalid" };
  }

  // Expiry.
  const nowSec = Math.floor(args.nowMs / 1000);
  if (nowSec >= payload.exp) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, payload };
}

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

function base64urlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlDecode(s: string): Buffer {
  // Re-pad to a multiple of 4 chars.
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function constantTimeEqual(a: string, b: string): boolean {
  // Strings can have different lengths — guard before timingSafeEqual,
  // which requires equal-length buffers. The length comparison itself
  // is not a timing oracle of cryptographic value.
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

function isCommitTokenPayload(v: unknown): v is CommitTokenPayload {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.stg === "string" &&
    typeof r.uid === "string" &&
    typeof r.oTy === "string" &&
    typeof r.oId === "string" &&
    typeof r.dMt === "string" &&
    typeof r.dSz === "number" &&
    Number.isFinite(r.dSz) &&
    typeof r.exp === "number" &&
    Number.isFinite(r.exp)
  );
}
