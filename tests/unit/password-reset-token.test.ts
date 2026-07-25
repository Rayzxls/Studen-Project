// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  PASSWORD_RESET_TTL_MS,
  createPasswordResetToken,
  passwordHashFingerprint,
  readPasswordResetToken,
} from "@/lib/identity/password-reset-token";

const secret = "test-auth-secret-at-least-32-chars-long";
const userId = "user_abc123";
const passwordHash = "$2b$12$abcdefghijklmnopqrstuv.OLDHASHvalue000000000000";
const now = new Date("2026-07-26T10:00:00.000Z");

describe("password reset token", () => {
  it("round-trips the user id and the hash fingerprint", async () => {
    const token = await createPasswordResetToken({
      userId,
      passwordHash,
      secret,
      now,
    });

    await expect(
      readPasswordResetToken({ token, secret, now })
    ).resolves.toEqual({
      userId,
      fingerprint: passwordHashFingerprint(passwordHash),
    });
  });

  it("changes the fingerprint when the hash changes (single-use basis)", () => {
    const before = passwordHashFingerprint(passwordHash);
    const after = passwordHashFingerprint(`${passwordHash}CHANGED`);
    expect(before).not.toEqual(after);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createPasswordResetToken({
      userId,
      passwordHash,
      secret,
      now,
    });
    await expect(
      readPasswordResetToken({
        token,
        secret: "another-secret-value-here-32b",
        now,
      })
    ).rejects.toMatchObject({ code: "password_reset_invalid" });
  });

  it("expires after the TTL", async () => {
    const token = await createPasswordResetToken({
      userId,
      passwordHash,
      secret,
      now,
    });
    const afterExpiry = new Date(now.getTime() + PASSWORD_RESET_TTL_MS + 1000);
    await expect(
      readPasswordResetToken({ token, secret, now: afterExpiry })
    ).rejects.toMatchObject({ code: "password_reset_invalid" });
  });

  it("refuses to mint with an empty secret", async () => {
    await expect(
      createPasswordResetToken({ userId, passwordHash, secret: "  ", now })
    ).rejects.toMatchObject({ code: "identity_foundation_not_found" });
  });
});
