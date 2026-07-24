import { describe, expect, it } from "vitest";

import {
  defaultAvatarVariant,
  deletionScheduledFor,
  effectiveTeacherInviteStatus,
  hashIdentityToken,
  hasRequiredConsent,
  identitySessionDeadlines,
  isIdentitySessionActive,
  nameContinuityUntil,
  normalizeVerifiedEmail,
  parseRealName,
  teacherInviteExpiresAt,
} from "@/lib/identity/foundation";
import {
  identityFoundationEnabled,
  identityFoundationMutationsEnabled,
} from "@/lib/identity/feature-flags";

describe("Identity V2 foundation", () => {
  it("normalizes a verified email without trusting display identity", () => {
    expect(normalizeVerifiedEmail("  Student@Example.COM ")).toBe(
      "student@example.com"
    );
    expect(() => normalizeVerifiedEmail("not-an-email")).toThrow();
  });

  it("hashes raw identity tokens deterministically without persisting them", () => {
    const rawToken = "identity-token-value";
    const digest = hashIdentityToken(rawToken);

    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).toBe(hashIdentityToken(rawToken));
    expect(digest).not.toBe(rawToken);
  });

  it("normalizes separate real-name fields and rejects control characters", () => {
    expect(
      parseRealName({
        firstName: "  Ada   Maria ",
        lastName: " Lovelace ",
      })
    ).toEqual({ firstName: "Ada Maria", lastName: "Lovelace" });
    expect(() =>
      parseRealName({ firstName: "Ada\nAdmin", lastName: "Lovelace" })
    ).toThrow();
  });

  it("derives Teacher Invite expiry and effective status", () => {
    const now = new Date("2026-07-24T00:00:00.000Z");
    const expiresAt = teacherInviteExpiresAt(now);

    expect(expiresAt.toISOString()).toBe("2026-07-31T00:00:00.000Z");
    expect(
      effectiveTeacherInviteStatus({
        status: "PENDING",
        expiresAt,
        now: new Date("2026-07-30T23:59:59.999Z"),
      })
    ).toBe("PENDING");
    expect(
      effectiveTeacherInviteStatus({
        status: "PENDING",
        expiresAt,
        now: expiresAt,
      })
    ).toBe("EXPIRED");
    expect(
      effectiveTeacherInviteStatus({
        status: "REVOKED",
        expiresAt,
        now: expiresAt,
      })
    ).toBe("REVOKED");
  });

  it("requires current Terms and Privacy acceptance independently", () => {
    const required = {
      termsOfUseVersion: "2026-07",
      privacyNoticeVersion: "2026-07",
    };

    expect(
      hasRequiredConsent(
        [
          { document: "TERMS_OF_USE", version: "2026-07" },
          { document: "PRIVACY_NOTICE", version: "2026-07" },
        ],
        required
      )
    ).toBe(true);
    expect(
      hasRequiredConsent(
        [{ document: "TERMS_OF_USE", version: "2026-07" }],
        required
      )
    ).toBe(false);
  });

  it("derives a stable privacy-safe default Avatar variant", () => {
    const first = defaultAvatarVariant("internal-user-id", 12);

    expect(first).toBe(defaultAvatarVariant("internal-user-id", 12));
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(12);
    expect(() => defaultAvatarVariant("internal-user-id", 0)).toThrow();
  });

  it("enforces both absolute and idle session expiry", () => {
    const createdAt = new Date("2026-07-01T00:00:00.000Z");
    const lastSeenAt = new Date("2026-07-20T00:00:00.000Z");
    const deadlines = identitySessionDeadlines({ createdAt, lastSeenAt });

    expect(deadlines.absoluteExpiresAt.toISOString()).toBe(
      "2026-07-31T00:00:00.000Z"
    );
    expect(deadlines.idleExpiresAt.toISOString()).toBe(
      "2026-07-27T00:00:00.000Z"
    );
    expect(
      isIdentitySessionActive({
        createdAt,
        lastSeenAt,
        revokedAt: null,
        now: new Date("2026-07-26T00:00:00.000Z"),
      })
    ).toBe(true);
    expect(
      isIdentitySessionActive({
        createdAt,
        lastSeenAt,
        revokedAt: null,
        now: new Date("2026-07-27T00:00:00.000Z"),
      })
    ).toBe(false);
  });

  it("derives recovery and name-continuity windows", () => {
    const now = new Date("2026-07-24T00:00:00.000Z");

    expect(deletionScheduledFor(now).toISOString()).toBe(
      "2026-08-23T00:00:00.000Z"
    );
    expect(nameContinuityUntil(now).toISOString()).toBe(
      "2026-08-07T00:00:00.000Z"
    );
  });

  it("keeps Identity V2 fail-closed by default", () => {
    expect(identityFoundationEnabled({})).toBe(false);
    expect(identityFoundationMutationsEnabled({})).toBe(false);
    expect(
      identityFoundationMutationsEnabled({
        IDENTITY_FOUNDATION_MUTATIONS_ENABLED: "1",
      })
    ).toBe(false);
    expect(
      identityFoundationMutationsEnabled({
        IDENTITY_FOUNDATION_ENABLED: "1",
        IDENTITY_FOUNDATION_MUTATIONS_ENABLED: "1",
      })
    ).toBe(true);
  });
});
