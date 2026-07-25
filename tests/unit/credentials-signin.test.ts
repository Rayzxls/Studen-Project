import { describe, expect, it } from "vitest";
import {
  evaluateCredentialsAccountGate,
  type CredentialsAccountSnapshot,
} from "@/lib/auth/credentials-signin";

const NOW = new Date("2026-07-25T00:00:00Z");
const FUTURE = new Date("2026-08-10T00:00:00Z");
const PAST = new Date("2026-07-20T00:00:00Z");

function snapshot(
  overrides: Partial<CredentialsAccountSnapshot> = {}
): CredentialsAccountSnapshot {
  return {
    isActive: true,
    deletedAt: null,
    accountStatus: "ACTIVE",
    deletionScheduledFor: null,
    email: "person@studennnn.local",
    ...overrides,
  };
}

describe("evaluateCredentialsAccountGate", () => {
  it("lets an active account through to sign in", () => {
    expect(evaluateCredentialsAccountGate(snapshot(), NOW)).toEqual({
      kind: "available",
    });
  });

  it("routes an in-window Deletion Pending account to recovery", () => {
    expect(
      evaluateCredentialsAccountGate(
        snapshot({
          accountStatus: "DELETION_PENDING",
          deletedAt: NOW,
          isActive: false,
          deletionScheduledFor: FUTURE,
        }),
        NOW
      )
    ).toEqual({ kind: "recoverable", email: "person@studennnn.local" });
  });

  it("keeps a Deletion Pending account unavailable once the window has passed", () => {
    expect(
      evaluateCredentialsAccountGate(
        snapshot({
          accountStatus: "DELETION_PENDING",
          deletedAt: NOW,
          isActive: false,
          deletionScheduledFor: PAST,
        }),
        NOW
      )
    ).toEqual({ kind: "unavailable" });
  });

  it("treats a Deletion Pending account with no scheduled date as unavailable", () => {
    expect(
      evaluateCredentialsAccountGate(
        snapshot({
          accountStatus: "DELETION_PENDING",
          deletedAt: NOW,
          isActive: false,
          deletionScheduledFor: null,
        }),
        NOW
      )
    ).toEqual({ kind: "unavailable" });
  });

  it("fails closed when an in-window pending account carries no email to recover", () => {
    expect(
      evaluateCredentialsAccountGate(
        snapshot({
          accountStatus: "DELETION_PENDING",
          deletedAt: NOW,
          isActive: false,
          deletionScheduledFor: FUTURE,
          email: null,
        }),
        NOW
      )
    ).toEqual({ kind: "unavailable" });
  });

  it.each(["SUSPENDED", "TERMINATED", "ANONYMIZED"] as const)(
    "never recovers a %s account even inside a scheduled window",
    (accountStatus) => {
      expect(
        evaluateCredentialsAccountGate(
          snapshot({
            accountStatus,
            isActive: false,
            deletionScheduledFor: FUTURE,
          }),
          NOW
        )
      ).toEqual({ kind: "unavailable" });
    }
  );

  it("falls back to legacy flags when no canonical status is recorded", () => {
    expect(
      evaluateCredentialsAccountGate(
        snapshot({ accountStatus: null, deletedAt: new Date("2026-07-15") }),
        NOW
      )
    ).toEqual({ kind: "unavailable" });
    expect(
      evaluateCredentialsAccountGate(
        snapshot({ accountStatus: null, isActive: true, deletedAt: null }),
        NOW
      )
    ).toEqual({ kind: "available" });
  });
});
