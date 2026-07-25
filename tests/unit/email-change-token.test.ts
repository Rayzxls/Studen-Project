// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  EMAIL_CHANGE_TTL_MS,
  createEmailChangeToken,
  emailFingerprint,
  readEmailChangeToken,
} from "@/lib/identity/email-change-token";

const secret = "test-auth-secret-at-least-32-chars-long";
const userId = "user_email_1";
const currentEmail = "old@example.com";
const newEmail = "new@example.com";
const now = new Date("2026-07-26T10:00:00.000Z");

describe("email change token", () => {
  it("round-trips the user id, new email, and current-email fingerprint", async () => {
    const token = await createEmailChangeToken({
      userId,
      currentEmail,
      newEmail,
      secret,
      now,
    });

    await expect(readEmailChangeToken({ token, secret, now })).resolves.toEqual(
      {
        userId,
        newEmail,
        fingerprint: emailFingerprint(currentEmail),
      }
    );
  });

  it("fingerprints case-insensitively and changes when the email changes", () => {
    expect(emailFingerprint("A@B.com")).toEqual(emailFingerprint("a@b.com"));
    expect(emailFingerprint(currentEmail)).not.toEqual(
      emailFingerprint(newEmail)
    );
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createEmailChangeToken({
      userId,
      currentEmail,
      newEmail,
      secret,
      now,
    });
    await expect(
      readEmailChangeToken({
        token,
        secret: "different-secret-32-bytes-min!!",
        now,
      })
    ).rejects.toMatchObject({ code: "email_change_invalid" });
  });

  it("expires after the TTL", async () => {
    const token = await createEmailChangeToken({
      userId,
      currentEmail,
      newEmail,
      secret,
      now,
    });
    const afterExpiry = new Date(now.getTime() + EMAIL_CHANGE_TTL_MS + 1000);
    await expect(
      readEmailChangeToken({ token, secret, now: afterExpiry })
    ).rejects.toMatchObject({ code: "email_change_invalid" });
  });
});
