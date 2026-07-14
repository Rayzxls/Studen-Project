import { describe, expect, it } from "vitest";
import {
  canAuthenticateWithAccountStatus,
  deriveLegacyAccountStatus,
  isAccountAvailableForAuthentication,
  resolveAccountStatus,
} from "@/lib/account/status";

describe("account status compatibility", () => {
  it.each([
    [{ isActive: true, deletedAt: null }, "ACTIVE"],
    [{ isActive: false, deletedAt: null }, "SUSPENDED"],
    [{ isActive: true, deletedAt: new Date("2026-07-15") }, "TERMINATED"],
    [
      {
        isActive: false,
        deletedAt: new Date("2026-07-15"),
        studentAnonymized: true,
      },
      "ANONYMIZED",
    ],
  ] as const)("maps legacy state %o to %s", (state, expected) => {
    expect(deriveLegacyAccountStatus(state)).toBe(expected);
  });

  it("prefers a canonical status after the additive migration", () => {
    expect(
      resolveAccountStatus({
        accountStatus: "SUSPENDED",
        isActive: true,
        deletedAt: null,
      })
    ).toBe("SUSPENDED");
  });

  it("allows authentication only for an active account", () => {
    expect(canAuthenticateWithAccountStatus("ACTIVE")).toBe(true);
    expect(canAuthenticateWithAccountStatus("SUSPENDED")).toBe(false);
    expect(canAuthenticateWithAccountStatus("TERMINATED")).toBe(false);
    expect(canAuthenticateWithAccountStatus("ANONYMIZED")).toBe(false);
  });

  it("keeps legacy authentication behavior during the additive rollout", () => {
    expect(
      isAccountAvailableForAuthentication({
        isActive: true,
        deletedAt: null,
      })
    ).toBe(true);
    expect(
      isAccountAvailableForAuthentication({
        isActive: false,
        deletedAt: null,
      })
    ).toBe(false);
    expect(
      isAccountAvailableForAuthentication({
        isActive: true,
        deletedAt: new Date("2026-07-15"),
      })
    ).toBe(false);
  });
});
