// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  PENDING_PROVIDER_LINK_TTL_MS,
  createPendingProviderLinkToken,
  readPendingProviderLinkToken,
} from "@/lib/identity/pending-provider-link";

const secret = "test-auth-secret-at-least-32-chars-long";
const now = new Date("2026-07-26T10:00:00.000Z");
const pending = { userId: "user_link_1", signInAt: 1785000000 };

describe("pending provider-link token", () => {
  it("round-trips the user id and re-auth timestamp", async () => {
    const token = await createPendingProviderLinkToken({
      pending,
      secret,
      now,
    });
    await expect(
      readPendingProviderLinkToken({ token, secret, now })
    ).resolves.toEqual(pending);
  });

  it("carries a null signInAt through", async () => {
    const token = await createPendingProviderLinkToken({
      pending: { userId: "u2", signInAt: null },
      secret,
      now,
    });
    await expect(
      readPendingProviderLinkToken({ token, secret, now })
    ).resolves.toEqual({ userId: "u2", signInAt: null });
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createPendingProviderLinkToken({
      pending,
      secret,
      now,
    });
    await expect(
      readPendingProviderLinkToken({
        token,
        secret: "some-other-secret-32-bytes-min!!",
        now,
      })
    ).rejects.toMatchObject({ code: "pending_provider_link_invalid" });
  });

  it("expires after the TTL", async () => {
    const token = await createPendingProviderLinkToken({
      pending,
      secret,
      now,
    });
    const afterExpiry = new Date(
      now.getTime() + PENDING_PROVIDER_LINK_TTL_MS + 1000
    );
    await expect(
      readPendingProviderLinkToken({ token, secret, now: afterExpiry })
    ).rejects.toMatchObject({ code: "pending_provider_link_invalid" });
  });
});
