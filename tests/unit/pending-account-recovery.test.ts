// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  PENDING_RECOVERY_TTL_MS,
  createPendingAccountRecoveryToken,
  readPendingAccountRecoveryToken,
} from "@/lib/identity/pending-account-recovery";
import { createOnboardingSessionHandoff } from "@/lib/identity/onboarding-session-handoff";

const secret = "test-auth-secret-at-least-32-chars-long";
const pending = { userId: "cmrypfaxd0004ug64qa7bc3xk", email: "s@example.com" };
const now = new Date("2026-07-24T10:00:00.000Z");

describe("pending account recovery token", () => {
  it("round-trips the account under recovery", async () => {
    const token = await createPendingAccountRecoveryToken({
      pending,
      secret,
      now,
    });
    await expect(
      readPendingAccountRecoveryToken({ token, secret, now })
    ).resolves.toEqual(pending);
  });

  it("rejects a different secret, a tamper, and an expired token", async () => {
    const token = await createPendingAccountRecoveryToken({
      pending,
      secret,
      now,
    });
    await expect(
      readPendingAccountRecoveryToken({
        token,
        secret: "another-secret-value-here-32",
        now,
      })
    ).rejects.toMatchObject({ code: "pending_account_recovery_invalid" });

    const tampered = `${token.slice(0, -3)}${token.slice(-3) === "aaa" ? "bbb" : "aaa"}`;
    await expect(
      readPendingAccountRecoveryToken({ token: tampered, secret, now })
    ).rejects.toMatchObject({ code: "pending_account_recovery_invalid" });

    const afterExpiry = new Date(
      now.getTime() + PENDING_RECOVERY_TTL_MS + 1000
    );
    await expect(
      readPendingAccountRecoveryToken({ token, secret, now: afterExpiry })
    ).rejects.toMatchObject({ code: "pending_account_recovery_invalid" });
  });

  it("refuses a session handoff token: the audience is not interchangeable", async () => {
    const handoff = await createOnboardingSessionHandoff({
      userId: pending.userId,
      secret,
      now,
    });
    await expect(
      readPendingAccountRecoveryToken({ token: handoff, secret, now })
    ).rejects.toMatchObject({ code: "pending_account_recovery_invalid" });
  });
});
