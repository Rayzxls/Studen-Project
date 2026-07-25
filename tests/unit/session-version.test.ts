import { describe, expect, it } from "vitest";

import { isSessionRevoked } from "@/lib/auth/session-version";

describe("session version revocation", () => {
  it("keeps a token whose version matches the account", () => {
    expect(isSessionRevoked(0, 0)).toBe(false);
    expect(isSessionRevoked(3, 3)).toBe(false);
  });

  it("revokes a token minted before the account was bumped", () => {
    expect(isSessionRevoked(0, 1)).toBe(true);
    expect(isSessionRevoked(2, 3)).toBe(true);
  });

  it("treats a legacy versionless token as version 0", () => {
    // Un-bumped account (0): a pre-field token still works.
    expect(isSessionRevoked(undefined, 0)).toBe(false);
    // Bumped account: the legacy token is revoked.
    expect(isSessionRevoked(undefined, 1)).toBe(true);
  });
});
