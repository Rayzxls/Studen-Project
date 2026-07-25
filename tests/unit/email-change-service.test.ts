// @vitest-environment node

import { beforeEach, describe, expect, it } from "vitest";

import { createCapturedEmailSender } from "@/lib/email";
import { Conflict } from "@/lib/errors";
import {
  createEmailChangeService,
  type EmailChangeDatabasePort,
  type EmailChangeUser,
} from "@/lib/identity/email-change-service";

const secret = "test-auth-secret-at-least-32-chars-long";

class FakeDb implements EmailChangeDatabasePort {
  users = new Map<string, EmailChangeUser & { emailVerifiedAt?: Date }>();
  requestAudits: string[] = [];
  changeAudits: string[] = [];

  add(user: EmailChangeUser) {
    this.users.set(user.userId, { ...user });
  }
  async findById(userId: string) {
    return this.users.get(userId) ?? null;
  }
  async writeRequestAudit(input: { userId: string }) {
    this.requestAudits.push(input.userId);
  }
  async applyChange(input: {
    userId: string;
    newEmail: string;
    updateIdentifier: boolean;
  }) {
    // Simulate the unique constraint: another account already owns the address.
    const taken = [...this.users.values()].some(
      (u) => u.userId !== input.userId && u.email === input.newEmail
    );
    if (taken) throw new Conflict("email_taken");
    const u = this.users.get(input.userId)!;
    u.email = input.newEmail;
    if (input.updateIdentifier) u.identifier = input.newEmail;
    this.changeAudits.push(input.userId);
  }
}

function makeService(db: FakeDb, enabled = true) {
  const sender = createCapturedEmailSender();
  const service = createEmailChangeService(db, {
    emailSender: sender,
    secret,
    mutationsEnabled: enabled,
    verifyUrl: (t) => `https://app.example/verify-email?token=${t}`,
  });
  return { service, sender };
}

const recent = () => new Date();
const tokenFrom = (url: string) => new URL(url).searchParams.get("token") ?? "";

let db: FakeDb;
beforeEach(() => {
  db = new FakeDb();
  db.add({
    userId: "u1",
    email: "old@studennnn.local",
    identifier: "old@studennnn.local", // identity-v2: identifier tracks email
    role: "TEACHER",
    isActive: true,
    deletedAt: null,
    accountStatus: "ACTIVE",
  });
});

describe("email change — request", () => {
  it("emails the verification link to the NEW address and audits", async () => {
    const { service, sender } = makeService(db);
    await service.request({
      actor: { userId: "u1", reauthenticatedAt: recent() },
      newEmail: "New@studennnn.local",
    });

    expect(sender.outbox).toHaveLength(1);
    expect(sender.outbox[0]?.to).toBe("new@studennnn.local");
    expect(sender.outbox[0]?.template.kind).toBe("email_change_verification");
    expect(db.requestAudits).toEqual(["u1"]);
  });

  it("requires a recent re-authentication", async () => {
    const { service } = makeService(db);
    const stale = new Date(Date.now() - 60 * 60 * 1000);
    await expect(
      service.request({
        actor: { userId: "u1", reauthenticatedAt: stale },
        newEmail: "new@studennnn.local",
      })
    ).rejects.toMatchObject({ code: "reauthentication_required" });
  });

  it("rejects an invalid or unchanged address", async () => {
    const { service } = makeService(db);
    await expect(
      service.request({
        actor: { userId: "u1", reauthenticatedAt: recent() },
        newEmail: "not-an-email",
      })
    ).rejects.toMatchObject({ code: "validation_error" });
    await expect(
      service.request({
        actor: { userId: "u1", reauthenticatedAt: recent() },
        newEmail: "OLD@studennnn.local",
      })
    ).rejects.toMatchObject({ code: "validation_error" });
  });
});

describe("email change — confirm", () => {
  async function requestToken(newEmail: string) {
    const { service, sender } = makeService(db);
    await service.request({
      actor: { userId: "u1", reauthenticatedAt: recent() },
      newEmail,
    });
    const token = tokenFrom(
      (sender.outbox[0]!.template as { verifyUrl: string }).verifyUrl
    );
    return { service, token };
  }

  it("updates the email and identifier, then rejects a reused link", async () => {
    const { service, token } = await requestToken("new@studennnn.local");
    const result = await service.confirm({ token });

    expect(result.newEmail).toBe("new@studennnn.local");
    const after = db.users.get("u1")!;
    expect(after.email).toBe("new@studennnn.local");
    expect(after.identifier).toBe("new@studennnn.local");
    expect(db.changeAudits).toEqual(["u1"]);

    await expect(service.confirm({ token })).rejects.toMatchObject({
      code: "email_change_superseded",
    });
  });

  it("refuses an address already used by another account", async () => {
    db.add({
      userId: "u2",
      email: "taken@studennnn.local",
      identifier: "taken@studennnn.local",
      role: "TEACHER",
      isActive: true,
      deletedAt: null,
      accountStatus: "ACTIVE",
    });
    const { service, token } = await requestToken("taken@studennnn.local");
    await expect(service.confirm({ token })).rejects.toMatchObject({
      code: "email_taken",
    });
    // The original email is untouched.
    expect(db.users.get("u1")!.email).toBe("old@studennnn.local");
  });

  it("rejects a tampered token", async () => {
    const { service } = makeService(db);
    await expect(
      service.confirm({ token: "not.a.valid.token" })
    ).rejects.toMatchObject({ code: "email_change_invalid" });
  });
});
