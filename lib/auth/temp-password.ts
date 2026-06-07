/**
 * Temporary password generator — Phase 10B · ADR-0026.
 *
 * PURE — no I/O, no Prisma. Uses node:crypto for entropy.
 *
 * Used by:
 *   - Admin reset-password Server Action (ADR-0026 § 2)
 *   - Future: CSV-import Teacher onboarding (Phase 2 — TODO migrate to
 *     use this helper instead of its inline generator)
 *
 * Shape: 12 random URL-safe base64 chars grouped 4-4-4 with hyphens,
 * so a typical output is `tx9-Bk2-PqZ-7Lm3`. The grouping makes it
 * mildly easier to read aloud (which Admin will be doing — the temp
 * password is relayed to the user via voice / LINE / handwritten note,
 * not email).
 *
 * Length × character set:
 *   - 12 base64url chars × 64 alphabet = 64^12 ≈ 2^72 bits of entropy
 *   - Substantially above NIST SP 800-63B minimum for a credential
 *     that expires on first login (mustResetPwd=true gate)
 *   - Brief enough to dictate over a phone call without errors
 *
 * The output is **not stored** beyond the bcrypt hash made from it
 * (CLAUDE.md hard rule). Reveal-once at the Admin UI; the audit row
 * captures the action but not the secret.
 */

import { randomBytes } from "node:crypto";

const GROUP_SIZE = 4;
const GROUP_COUNT = 3;
const TOTAL_CHARS = GROUP_SIZE * GROUP_COUNT;

/**
 * Generate a cryptographically-strong temporary password.
 *
 * Deterministic test seam: pass a `rng` function to override the
 * entropy source for unit tests. Defaults to node:crypto.randomBytes.
 *
 * The returned string is 14 chars including the two hyphens at indices
 * 4 and 9 (`xxxx-xxxx-xxxx`).
 */
export function generateTempPassword(
  rng: (n: number) => Buffer = randomBytes
): string {
  // 12 random bytes → 16 base64url chars; we slice to TOTAL_CHARS so the
  // alphabet bias from base64 padding is irrelevant (we never include it).
  const buf = rng(TOTAL_CHARS); // 12 bytes gives us 12 base64 chars after slice
  const raw = bufToBase64Url(buf).slice(0, TOTAL_CHARS);
  const groups: string[] = [];
  for (let i = 0; i < GROUP_COUNT; i++) {
    groups.push(raw.slice(i * GROUP_SIZE, (i + 1) * GROUP_SIZE));
  }
  return groups.join("-");
}

/**
 * URL-safe base64 (RFC 4648 § 5) — no `=` padding, `+/` swapped for `-_`.
 * node 18+ has `buf.toString('base64url')` natively; we re-implement here
 * to keep the function pure-JS for shoehorn coverage in tests.
 */
function bufToBase64Url(buf: Buffer): string {
  const ALPHABET =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let out = "";
  for (let i = 0; i < buf.length; i += 3) {
    const b0 = buf[i]!;
    const b1 = i + 1 < buf.length ? buf[i + 1]! : 0;
    const b2 = i + 2 < buf.length ? buf[i + 2]! : 0;
    out += ALPHABET[(b0 >> 2) & 0x3f];
    out += ALPHABET[((b0 << 4) | (b1 >> 4)) & 0x3f];
    if (i + 1 < buf.length) {
      out += ALPHABET[((b1 << 2) | (b2 >> 6)) & 0x3f];
    }
    if (i + 2 < buf.length) {
      out += ALPHABET[b2 & 0x3f];
    }
  }
  return out;
}
