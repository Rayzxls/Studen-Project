// @vitest-environment node

import { randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { User } from "next-auth";

import { db } from "@/lib/db/client";
import { onboardingSessionProviderIfEnabled } from "@/lib/auth/onboarding-session-provider";
import { createOnboardingSessionHandoff } from "@/lib/identity/onboarding-session-handoff";
import { createPrismaStudentOnboardingService } from "@/lib/identity/student-onboarding-prisma";
import { assertIsolatedTestDatabase } from "@/tests/helpers/database-safety";

const env = {
  IDENTITY_FOUNDATION_ENABLED: "1",
  IDENTITY_FOUNDATION_MUTATIONS_ENABLED: "1",
  IDENTITY_TERMS_VERSION: "terms-2026-07",
  IDENTITY_PRIVACY_VERSION: "privacy-2026-07",
  AUTH_SECRET: "integration-test-auth-secret-at-least-32-chars",
};

const consent = {
  termsOfUseVersion: env.IDENTITY_TERMS_VERSION,
  privacyNoticeVersion: env.IDENTITY_PRIVACY_VERSION,
};

/**
 * The programmatic handoff provider keeps its `authorize` under NextAuth's
 * `options`, the same place the Google provider keeps `profile`.
 */
type HandoffOptions = {
  authorize: (raw: Record<string, unknown>) => Promise<User | null>;
};
function authorizeOf(): HandoffOptions["authorize"] {
  const [provider] = onboardingSessionProviderIfEnabled({ env });
  return (provider as unknown as { options: HandoffOptions }).options.authorize;
}

async function registerDisposableStudent(email: string): Promise<string> {
  const service = createPrismaStudentOnboardingService(db, env);
  const result = await service.register({
    google: {
      providerAccountId: `google-${randomBytes(8).toString("hex")}`,
      email,
      emailVerified: true,
    },
    firstName: "สมชาย",
    lastName: "ใจดี",
    consent,
    occurredAt: new Date("2026-07-24T06:05:00.000Z"),
  });
  return result.userId;
}

describe("Google onboarding session handoff (one-click)", () => {
  let studentUserId = "";
  let studentEmail = "";

  beforeEach(() => {
    assertIsolatedTestDatabase();
    const prefix = `identity_session_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
    studentEmail = `${prefix}@example.com`;
    studentUserId = "";
  });

  afterEach(async () => {
    await db.auditLog.deleteMany({
      where: {
        OR: [
          ...(studentUserId ? [{ actorId: studentUserId }] : []),
          { targetLabel: studentEmail },
        ],
      },
    });
    await db.user.deleteMany({ where: { email: studentEmail } });
  });

  it("exchanges a fresh handoff for a session carrying the real database id", async () => {
    studentUserId = await registerDisposableStudent(studentEmail);

    const token = await createOnboardingSessionHandoff({
      userId: studentUserId,
      secret: env.AUTH_SECRET,
    });

    const user = await authorizeOf()({ handoff: token });

    // The id must be the database cuid, not a fresh UUID — this is exactly the
    // value the session then carries into every `findUnique({ where: { id } })`.
    expect(user).toMatchObject({
      id: studentUserId,
      role: "STUDENT",
      identifier: studentEmail,
      email: studentEmail,
      mustResetPwd: false, // dependency-gate-allow(temporary-password): Google account carries no reset flow
    });
    expect(user?.id).toMatch(/^c[a-z0-9]{20,}$/); // Prisma cuid shape, not a UUID
  });

  it("refuses a tampered token, a valid token for a missing account, and an empty token", async () => {
    const authorize = authorizeOf();

    const good = await createOnboardingSessionHandoff({
      userId: `cmr${randomBytes(10).toString("hex")}`,
      secret: env.AUTH_SECRET,
    });
    const tampered = `${good.slice(0, -3)}${good.slice(-3) === "aaa" ? "bbb" : "aaa"}`;
    expect(await authorize({ handoff: tampered })).toBeNull();

    // Correctly signed, but its subject is a user that does not exist.
    const ghost = await createOnboardingSessionHandoff({
      userId: `cmrghost${randomBytes(8).toString("hex")}`,
      secret: env.AUTH_SECRET,
    });
    expect(await authorize({ handoff: ghost })).toBeNull();

    expect(await authorize({ handoff: "" })).toBeNull();
  });

  it("refuses a valid handoff once the account is no longer available", async () => {
    studentUserId = await registerDisposableStudent(studentEmail);

    // Suspend the freshly created account, then present a perfectly valid token.
    await db.user.update({
      where: { id: studentUserId },
      data: { accountStatus: "SUSPENDED", isActive: false },
    });

    const token = await createOnboardingSessionHandoff({
      userId: studentUserId,
      secret: env.AUTH_SECRET,
    });

    expect(await authorizeOf()({ handoff: token })).toBeNull();
  });
});
