import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "@/lib/errors";
import {
  createTeacherInviteService,
  type TeacherInviteDatabasePort,
  type TeacherInviteRecord,
  type TeacherInviteTransactionPort,
  type TeacherInviteUserRecord,
} from "@/lib/identity/teacher-invite-service";

const now = new Date("2026-07-24T03:00:00.000Z");
const admin: TeacherInviteUserRecord = {
  userId: "admin-1",
  role: "ADMIN",
  accountStatus: "ACTIVE",
  deletedAt: null,
};

function pendingInvite(
  input: Partial<TeacherInviteRecord> = {}
): TeacherInviteRecord {
  return {
    inviteId: "invite-1",
    email: "teacher@example.com",
    status: "PENDING",
    expiresAt: new Date("2026-07-31T03:00:00.000Z"),
    acceptedByUserId: null,
    ...input,
  };
}

function createHarness() {
  const usersById = new Map<string, TeacherInviteUserRecord>([
    [admin.userId, admin],
  ]);
  const usersByEmail = new Map<string, TeacherInviteUserRecord>();
  const invites = new Map<string, TeacherInviteRecord>();
  let inviteSequence = 0;

  const tx: TeacherInviteTransactionPort = {
    findUser: vi.fn(async (userId) => usersById.get(userId) ?? null),
    findUserByEmail: vi.fn(async (email) => usersByEmail.get(email) ?? null),
    listPendingInviteIds: vi.fn(async (email) =>
      Array.from(invites.values())
        .filter(
          (invite) => invite.email === email && invite.status === "PENDING"
        )
        .map((invite) => invite.inviteId)
    ),
    createInvite: vi.fn(async (input) => {
      inviteSequence += 1;
      const invite = pendingInvite({
        inviteId: `invite-${inviteSequence}`,
        email: input.email,
        expiresAt: input.expiresAt,
      });
      invites.set(invite.inviteId, invite);
      return invite;
    }),
    findInvite: vi.fn(async (inviteId) => invites.get(inviteId) ?? null),
    revokeInvites: vi.fn(async (input) => {
      for (const inviteId of input.inviteIds) {
        const invite = invites.get(inviteId);
        if (invite?.status === "PENDING") {
          invites.set(inviteId, { ...invite, status: "REVOKED" });
        }
      }
    }),
    createAuditLog: vi.fn(async () => undefined),
  };

  const database: TeacherInviteDatabasePort = {
    transaction: vi.fn(async (work) => work(tx)),
  };

  return {
    database,
    invites,
    tx,
    usersByEmail,
    usersById,
  };
}

function expectHttpCode(error: unknown, code: string): void {
  expect(error).toBeInstanceOf(HttpError);
  expect((error as HttpError).code).toBe(code);
}

describe("Teacher Invite transactional service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails closed before opening a transaction when mutations are disabled", async () => {
    const harness = createHarness();
    const service = createTeacherInviteService(harness.database, {
      mutationsEnabled: false,
    });

    await expect(
      service.issue({
        actorUserId: admin.userId,
        email: "teacher@example.com",
        occurredAt: now,
      })
    ).rejects.toMatchObject({ code: "identity_foundation_not_found" });
    expect(harness.database.transaction).not.toHaveBeenCalled();
  });

  it("normalizes email and returns the raw token only to the caller", async () => {
    const harness = createHarness();
    const service = createTeacherInviteService(harness.database, {
      mutationsEnabled: true,
      tokenFactory: () => "a".repeat(43),
    });

    const result = await service.issue({
      actorUserId: admin.userId,
      email: "  Teacher@Example.COM ",
      occurredAt: now,
    });

    expect(result).toEqual({
      inviteId: "invite-1",
      email: "teacher@example.com",
      rawToken: "a".repeat(43),
      expiresAt: new Date("2026-07-31T03:00:00.000Z"),
      replacedInviteCount: 0,
    });
    expect(harness.tx.createInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "teacher@example.com",
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      })
    );
    expect(harness.tx.createInvite).not.toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: "a".repeat(43) })
    );
  });

  it("invalidates every pending invite before issuing a replacement", async () => {
    const harness = createHarness();
    harness.invites.set("old-1", pendingInvite({ inviteId: "old-1" }));
    harness.invites.set("old-2", pendingInvite({ inviteId: "old-2" }));
    const service = createTeacherInviteService(harness.database, {
      mutationsEnabled: true,
      tokenFactory: () => "b".repeat(43),
    });

    const result = await service.issue({
      actorUserId: admin.userId,
      email: "teacher@example.com",
      occurredAt: now,
    });

    expect(result.replacedInviteCount).toBe(2);
    expect(harness.tx.revokeInvites).toHaveBeenCalledWith({
      inviteIds: ["old-1", "old-2"],
      revokedAt: now,
      revokedByUserId: admin.userId,
      reason: "replaced_by_new_invite",
    });
    expect(harness.tx.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "TEACHER_INVITE_REPLACED" })
    );
  });

  it("fails closed when the verified email belongs to another role", async () => {
    const harness = createHarness();
    harness.usersByEmail.set("student@example.com", {
      userId: "student-1",
      role: "STUDENT",
      accountStatus: "ACTIVE",
      deletedAt: null,
    });
    const service = createTeacherInviteService(harness.database, {
      mutationsEnabled: true,
      tokenFactory: () => "c".repeat(43),
    });

    try {
      await service.issue({
        actorUserId: admin.userId,
        email: "student@example.com",
        occurredAt: now,
      });
      throw new Error("expected issue to fail");
    } catch (error) {
      expectHttpCode(error, "teacher_invite_role_collision");
    }

    expect(harness.tx.createInvite).not.toHaveBeenCalled();
  });

  it("does not invite an email that already owns a Teacher account", async () => {
    const harness = createHarness();
    harness.usersByEmail.set("teacher@example.com", {
      userId: "teacher-1",
      role: "TEACHER",
      accountStatus: "ACTIVE",
      deletedAt: null,
    });
    const service = createTeacherInviteService(harness.database, {
      mutationsEnabled: true,
      tokenFactory: () => "d".repeat(43),
    });

    await expect(
      service.issue({
        actorUserId: admin.userId,
        email: "teacher@example.com",
        occurredAt: now,
      })
    ).rejects.toMatchObject({ code: "teacher_invite_account_exists" });
  });

  it("requires an active Admin actor", async () => {
    const harness = createHarness();
    harness.usersById.set("teacher-actor", {
      userId: "teacher-actor",
      role: "TEACHER",
      accountStatus: "ACTIVE",
      deletedAt: null,
    });
    const service = createTeacherInviteService(harness.database, {
      mutationsEnabled: true,
      tokenFactory: () => "e".repeat(43),
    });

    await expect(
      service.issue({
        actorUserId: "teacher-actor",
        email: "new-teacher@example.com",
        occurredAt: now,
      })
    ).rejects.toMatchObject({ code: "teacher_invite_admin_required" });
  });

  it("revokes a pending invite and writes matching audit evidence", async () => {
    const harness = createHarness();
    harness.invites.set("invite-9", pendingInvite({ inviteId: "invite-9" }));
    const service = createTeacherInviteService(harness.database, {
      mutationsEnabled: true,
    });

    await service.revoke({
      actorUserId: admin.userId,
      inviteId: "invite-9",
      reason: "Address was entered incorrectly",
      occurredAt: now,
    });

    expect(harness.invites.get("invite-9")?.status).toBe("REVOKED");
    expect(harness.tx.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "TEACHER_INVITE_REVOKED",
        before: { status: "PENDING" },
        after: { status: "REVOKED" },
      })
    );
  });

  it("rejects an accepted invite instead of rewriting its history", async () => {
    const harness = createHarness();
    harness.invites.set(
      "accepted-1",
      pendingInvite({
        inviteId: "accepted-1",
        status: "ACCEPTED",
        acceptedByUserId: "teacher-1",
      })
    );
    const service = createTeacherInviteService(harness.database, {
      mutationsEnabled: true,
    });

    await expect(
      service.revoke({
        actorUserId: admin.userId,
        inviteId: "accepted-1",
        reason: "This should remain accepted",
        occurredAt: now,
      })
    ).rejects.toMatchObject({ code: "teacher_invite_not_pending" });
    expect(harness.tx.revokeInvites).not.toHaveBeenCalled();
  });
});
