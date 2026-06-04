/**
 * PURE commit-token sign + verify — `lib/storage/jwt.ts` coverage.
 *
 * Exercises every reason discriminant of VerifyCommitTokenResult plus the
 * round-trip property, expiry behaviour at the exact second boundary,
 * algorithm-confusion defense, and signature tampering.
 */

import { describe, expect, it } from "vitest";
import {
  signCommitToken,
  verifyCommitToken,
  type CommitTokenPayload,
} from "@/lib/storage/jwt";

const SECRET = "test-secret-do-not-use-in-prod";
const BASE_PAYLOAD: Omit<CommitTokenPayload, "exp"> = {
  stg: "staging/user-1/abc-123",
  uid: "user-1",
  oTy: "SUBMISSION_VERSION",
  oId: "ver-1",
  dMt: "application/pdf",
  dSz: 1024,
};

// ─────────────────────────────────────────────────────────────
// Round-trip
// ─────────────────────────────────────────────────────────────

describe("signCommitToken + verifyCommitToken", () => {
  it("round-trips a valid token", () => {
    const now = 1_700_000_000_000;
    const token = signCommitToken({
      payload: BASE_PAYLOAD,
      secret: SECRET,
      nowMs: now,
      ttlMs: 600_000, // 10 min
    });
    const result = verifyCommitToken({
      token,
      secret: SECRET,
      nowMs: now,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.stg).toBe(BASE_PAYLOAD.stg);
      expect(result.payload.uid).toBe(BASE_PAYLOAD.uid);
      expect(result.payload.dSz).toBe(1024);
      // exp = floor((now + ttl) / 1000)
      expect(result.payload.exp).toBe(Math.floor((now + 600_000) / 1000));
    }
  });

  it("emits a JWT-shaped three-part token", () => {
    const token = signCommitToken({
      payload: BASE_PAYLOAD,
      secret: SECRET,
      nowMs: 0,
      ttlMs: 600_000,
    });
    expect(token.split(".").length).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────
// Expiry behaviour
// ─────────────────────────────────────────────────────────────

describe("verifyCommitToken — expiry", () => {
  it("accepts a token 1ms before exp", () => {
    const issuedAt = 1_700_000_000_000;
    const ttl = 600_000;
    const expSec = Math.floor((issuedAt + ttl) / 1000);
    const token = signCommitToken({
      payload: BASE_PAYLOAD,
      secret: SECRET,
      nowMs: issuedAt,
      ttlMs: ttl,
    });
    // 1 ms before the second boundary the token expires.
    const result = verifyCommitToken({
      token,
      secret: SECRET,
      nowMs: expSec * 1000 - 1,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a token at the exact exp second (>= comparison)", () => {
    const issuedAt = 1_700_000_000_000;
    const ttl = 600_000;
    const expSec = Math.floor((issuedAt + ttl) / 1000);
    const token = signCommitToken({
      payload: BASE_PAYLOAD,
      secret: SECRET,
      nowMs: issuedAt,
      ttlMs: ttl,
    });
    const result = verifyCommitToken({
      token,
      secret: SECRET,
      nowMs: expSec * 1000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");
  });

  it("rejects a token 1s past exp", () => {
    const now = 1_700_000_000_000;
    const token = signCommitToken({
      payload: BASE_PAYLOAD,
      secret: SECRET,
      nowMs: now,
      ttlMs: 1_000,
    });
    const result = verifyCommitToken({
      token,
      secret: SECRET,
      nowMs: now + 5_000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");
  });
});

// ─────────────────────────────────────────────────────────────
// Signature / shape tampering
// ─────────────────────────────────────────────────────────────

describe("verifyCommitToken — tampering", () => {
  it("rejects a malformed token (not 3 parts)", () => {
    const result = verifyCommitToken({
      token: "header.payload",
      secret: SECRET,
      nowMs: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("malformed");
  });

  it("rejects a token signed with a different secret", () => {
    const now = 1_700_000_000_000;
    const token = signCommitToken({
      payload: BASE_PAYLOAD,
      secret: "first-secret",
      nowMs: now,
      ttlMs: 600_000,
    });
    const result = verifyCommitToken({
      token,
      secret: "different-secret",
      nowMs: now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("signature_invalid");
  });

  it("rejects a token with a flipped signature byte", () => {
    const now = 1_700_000_000_000;
    const token = signCommitToken({
      payload: BASE_PAYLOAD,
      secret: SECRET,
      nowMs: now,
      ttlMs: 600_000,
    });
    const [h, p, s] = token.split(".") as [string, string, string];
    // Flip the last char of the signature with a different valid base64url char.
    const last = s.charAt(s.length - 1);
    const flipped = (last === "A" ? "B" : "A") as "A" | "B";
    const tampered = `${h}.${p}.${s.slice(0, -1)}${flipped}`;
    const result = verifyCommitToken({
      token: tampered,
      secret: SECRET,
      nowMs: now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("signature_invalid");
  });

  it("rejects a none-alg header (algorithm-confusion defence)", () => {
    // Hand-crafted token with alg=none.
    const noneHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" }))
      .toString("base64")
      .replace(/=+$/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    const payload = Buffer.from(
      JSON.stringify({ ...BASE_PAYLOAD, exp: 9_999_999_999 })
    )
      .toString("base64")
      .replace(/=+$/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    const result = verifyCommitToken({
      token: `${noneHeader}.${payload}.`,
      secret: SECRET,
      nowMs: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(["alg_mismatch", "header_invalid"]).toContain(result.reason);
    }
  });

  it("rejects an unparseable payload", async () => {
    const now = 1_700_000_000_000;
    // Sign a token, then replace the payload with garbage but a valid signature
    // for THAT garbage so we exercise the JSON parse failure path.
    const headerB64 = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"; // canonical
    const garbage = "not-base64-json";
    const { createHmac } = await import("node:crypto");
    const sig = createHmac("sha256", SECRET)
      .update(`${headerB64}.${garbage}`)
      .digest()
      .toString("base64")
      .replace(/=+$/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    const result = verifyCommitToken({
      token: `${headerB64}.${garbage}.${sig}`,
      secret: SECRET,
      nowMs: now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("payload_invalid");
  });
});

// ─────────────────────────────────────────────────────────────
// Edge cases
// ─────────────────────────────────────────────────────────────

describe("signCommitToken — edge cases", () => {
  it("throws when secret is empty", () => {
    expect(() =>
      signCommitToken({
        payload: BASE_PAYLOAD,
        secret: "",
        nowMs: 0,
        ttlMs: 1000,
      })
    ).toThrow();
  });

  it("verify throws when secret is empty", () => {
    expect(() =>
      verifyCommitToken({
        token: "a.b.c",
        secret: "",
        nowMs: 0,
      })
    ).toThrow();
  });
});
