// @vitest-environment node

import { beforeEach, describe, expect, it } from "vitest";

import { createCapturedEmailSender } from "@/lib/email";
import { DISABLED_COMPATIBILITY_PASSWORD_HASH } from "@/lib/identity/foundation";
import {
  createPasswordRecoveryService,
  type RecoverableUser,
  type PasswordRecoveryDatabasePort,
} from "@/lib/identity/password-recovery-service";

const secret = "test-auth-secret-at-least-32-chars-long";

type StoredUser = RecoverableUser & { sessionVersion: number };

class FakeDb implements PasswordRecoveryDatabasePort {
  users = new Map<string, StoredUser>();
  requestAudits: string[] = [];
  completeAudits: string[] = [];

  add(user: StoredUser) {
    this.users.set(user.userId, user);
  }
  async findByEmail(email: string) {
    return [...this.users.values()].find((u) => u.email === email) ?? null;
  }
  async findById(userId: string) {
    return this.users.get(userId) ?? null;
  }
  async writeRequestAudit(input: { userId: string }) {
    this.requestAudits.push(input.userId);
  }
  async applyReset(input: { userId: string; passwordHash: string }) {
    const u = this.users.get(input.userId);
    if (!u) return;
    u.passwordHash = input.passwordHash;
    u.sessionVersion += 1; // revoke other sessions
    this.completeAudits.push(input.userId);
  }
}

let counter = 0;
// Simulates bcrypt re-salting: a fresh hash every call.
const fakeHash = async (plain: string) => `hashed$${plain}$${++counter}`;
const resetUrl = (token: string) =>
  `https://app.example/reset-password/confirm?token=${token}`;

function makeService(db: FakeDb, enabled = true) {
  const sender = createCapturedEmailSender();
  const service = createPasswordRecoveryService(db, {
    emailSender: sender,
    secret,
    mutationsEnabled: enabled,
    hashPassword: fakeHash,
    resetUrl,
  });
  return { service, sender };
}

function tokenFrom(url: string): string {
  return new URL(url).searchParams.get("token") ?? "";
}

let db: FakeDb;
beforeEach(() => {
  db = new FakeDb();
  db.add({
    userId: "u1",
    email: "person@studennnn.local",
    role: "STUDENT",
    passwordHash: "$2b$12$originalhashvalue0000000000000000000000000000",
    isActive: true,
    deletedAt: null,
    accountStatus: "ACTIVE",
    sessionVersion: 3,
  });
});

describe("password recovery — request", () => {
  it("emails a single-use link to a recoverable account and audits it", async () => {
    const { service, sender } = makeService(db);
    await service.request({ email: "person@studennnn.local" });

    expect(sender.outbox).toHaveLength(1);
    expect(sender.outbox[0]?.to).toBe("person@studennnn.local");
    expect(sender.outbox[0]?.template.kind).toBe("password_recovery");
    expect(db.requestAudits).toEqual(["u1"]);
  });

  it("stays silent for an unknown email (no enumeration)", async () => {
    const { service, sender } = makeService(db);
    await service.request({ email: "nobody@studennnn.local" });
    expect(sender.outbox).toHaveLength(0);
    expect(db.requestAudits).toEqual([]);
  });

  it("does not email a Google-only account with no fallback password", async () => {
    db.users.get("u1")!.passwordHash = DISABLED_COMPATIBILITY_PASSWORD_HASH;
    const { service, sender } = makeService(db);
    await service.request({ email: "person@studennnn.local" });
    expect(sender.outbox).toHaveLength(0);
  });

  it("does not email a suspended account", async () => {
    db.users.get("u1")!.accountStatus = "SUSPENDED";
    const { service, sender } = makeService(db);
    await service.request({ email: "person@studennnn.local" });
    expect(sender.outbox).toHaveLength(0);
  });
});

describe("password recovery — complete", () => {
  it("sets a new password, revokes other sessions, and audits", async () => {
    const { service, sender } = makeService(db);
    await service.request({ email: "person@studennnn.local" });
    const token = tokenFrom(
      (sender.outbox[0]!.template as { recoveryUrl: string }).recoveryUrl
    );

    const before = db.users.get("u1")!;
    const beforeVersion = before.sessionVersion;
    const beforeHash = before.passwordHash;

    const result = await service.complete({
      token,
      newPassword: "a-strong-new-pass-123",
    });

    expect(result.userId).toBe("u1");
    const after = db.users.get("u1")!;
    expect(after.passwordHash).not.toBe(beforeHash);
    expect(after.sessionVersion).toBe(beforeVersion + 1);
    expect(db.completeAudits).toEqual(["u1"]);
  });

  it("refuses to reuse a link after the password has changed", async () => {
    const { service, sender } = makeService(db);
    await service.request({ email: "person@studennnn.local" });
    const token = tokenFrom(
      (sender.outbox[0]!.template as { recoveryUrl: string }).recoveryUrl
    );

    await service.complete({ token, newPassword: "a-strong-new-pass-123" });

    await expect(
      service.complete({ token, newPassword: "another-strong-pass-456" })
    ).rejects.toMatchObject({ code: "password_reset_already_used" });
  });

  it("rejects a weak password without changing the hash", async () => {
    const { service, sender } = makeService(db);
    await service.request({ email: "person@studennnn.local" });
    const token = tokenFrom(
      (sender.outbox[0]!.template as { recoveryUrl: string }).recoveryUrl
    );
    const beforeHash = db.users.get("u1")!.passwordHash;

    await expect(
      service.complete({ token, newPassword: "short" })
    ).rejects.toMatchObject({ code: "validation_error" });
    expect(db.users.get("u1")!.passwordHash).toBe(beforeHash);
  });

  it("rejects a tampered token", async () => {
    const { service } = makeService(db);
    await expect(
      service.complete({
        token: "not.a.valid.token",
        newPassword: "a-strong-new-pass-123",
      })
    ).rejects.toMatchObject({ code: "password_reset_invalid" });
  });

  it("fails closed when mutations are disabled", async () => {
    const { service } = makeService(db, false);
    await expect(
      service.request({ email: "person@studennnn.local" })
    ).rejects.toMatchObject({ code: "identity_foundation_not_found" });
  });
});
