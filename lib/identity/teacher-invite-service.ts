import { randomBytes } from "node:crypto";

import type { Role } from "@prisma/client";
import { z } from "zod";

import { Conflict, Forbidden, NotFound } from "@/lib/errors";
import {
  effectiveTeacherInviteStatus,
  hashIdentityToken,
  normalizeVerifiedEmail,
  teacherInviteExpiresAt,
  type PersistedTeacherInviteStatus,
} from "./foundation";

const RevokeReasonSchema = z.string().trim().min(5).max(500);

export type TeacherInviteUserRecord = {
  userId: string;
  role: Role;
  accountStatus:
    | "ACTIVE"
    | "SUSPENDED"
    | "DELETION_PENDING"
    | "TERMINATED"
    | "ANONYMIZED";
  deletedAt: Date | null;
};

export type TeacherInviteRecord = {
  inviteId: string;
  email: string;
  status: PersistedTeacherInviteStatus;
  expiresAt: Date;
  acceptedByUserId: string | null;
};

export type TeacherInviteAuditAction =
  | "TEACHER_INVITE_ISSUED"
  | "TEACHER_INVITE_REPLACED"
  | "TEACHER_INVITE_REVOKED";

export interface TeacherInviteTransactionPort {
  findUser(userId: string): Promise<TeacherInviteUserRecord | null>;
  findUserByEmail(email: string): Promise<TeacherInviteUserRecord | null>;
  listPendingInviteIds(email: string): Promise<string[]>;
  createInvite(input: {
    email: string;
    tokenHash: string;
    expiresAt: Date;
    createdAt: Date;
    createdByUserId: string;
  }): Promise<TeacherInviteRecord>;
  findInvite(inviteId: string): Promise<TeacherInviteRecord | null>;
  revokeInvites(input: {
    inviteIds: string[];
    revokedAt: Date;
    revokedByUserId: string;
    reason: string;
  }): Promise<void>;
  createAuditLog(input: {
    actorId: string;
    action: TeacherInviteAuditAction;
    targetId: string;
    targetLabel: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    reason?: string;
    timestamp: Date;
  }): Promise<void>;
}

export interface TeacherInviteDatabasePort {
  transaction<T>(
    work: (tx: TeacherInviteTransactionPort) => Promise<T>
  ): Promise<T>;
}

export type TeacherInviteServiceOptions = {
  mutationsEnabled: boolean;
  tokenFactory?: () => string;
};

export type IssuedTeacherInvite = {
  inviteId: string;
  email: string;
  rawToken: string;
  expiresAt: Date;
  replacedInviteCount: number;
};

function defaultTokenFactory(): string {
  return randomBytes(32).toString("base64url");
}

function assertMutationsEnabled(enabled: boolean): void {
  if (!enabled) {
    throw new NotFound("identity_foundation_not_found");
  }
}

function assertActiveAdmin(
  actor: TeacherInviteUserRecord | null
): asserts actor is TeacherInviteUserRecord {
  if (!actor) {
    throw new NotFound("teacher_invite_actor_not_found");
  }
  if (
    actor.role !== "ADMIN" ||
    actor.accountStatus !== "ACTIVE" ||
    actor.deletedAt !== null
  ) {
    throw new Forbidden("teacher_invite_admin_required");
  }
}

function assertEmailAvailable(existing: TeacherInviteUserRecord | null): void {
  if (!existing) return;

  if (existing.role === "TEACHER") {
    throw new Conflict("teacher_invite_account_exists");
  }

  throw new Conflict("teacher_invite_role_collision");
}

export function createTeacherInviteService(
  database: TeacherInviteDatabasePort,
  options: TeacherInviteServiceOptions
) {
  const tokenFactory = options.tokenFactory ?? defaultTokenFactory;

  return {
    async issue(input: {
      actorUserId: string;
      email: string;
      occurredAt: Date;
    }): Promise<IssuedTeacherInvite> {
      assertMutationsEnabled(options.mutationsEnabled);

      const email = normalizeVerifiedEmail(input.email);
      const rawToken = tokenFactory();
      if (rawToken.length < 32) {
        throw new Error("teacher_invite_token_too_short");
      }
      const tokenHash = hashIdentityToken(rawToken);
      const expiresAt = teacherInviteExpiresAt(input.occurredAt);

      const result = await database.transaction(async (tx) => {
        const [actor, existingUser] = await Promise.all([
          tx.findUser(input.actorUserId),
          tx.findUserByEmail(email),
        ]);

        assertActiveAdmin(actor);
        assertEmailAvailable(existingUser);

        const pendingInviteIds = await tx.listPendingInviteIds(email);
        if (pendingInviteIds.length > 0) {
          await tx.revokeInvites({
            inviteIds: pendingInviteIds,
            revokedAt: input.occurredAt,
            revokedByUserId: actor.userId,
            reason: "replaced_by_new_invite",
          });
        }

        const invite = await tx.createInvite({
          email,
          tokenHash,
          expiresAt,
          createdAt: input.occurredAt,
          createdByUserId: actor.userId,
        });

        await tx.createAuditLog({
          actorId: actor.userId,
          action:
            pendingInviteIds.length > 0
              ? "TEACHER_INVITE_REPLACED"
              : "TEACHER_INVITE_ISSUED",
          targetId: invite.inviteId,
          targetLabel: email,
          after: {
            email,
            expiresAt: expiresAt.toISOString(),
            replacedInviteCount: pendingInviteIds.length,
          },
          timestamp: input.occurredAt,
        });

        return {
          inviteId: invite.inviteId,
          replacedInviteCount: pendingInviteIds.length,
        };
      });

      return {
        ...result,
        email,
        rawToken,
        expiresAt,
      };
    },

    async revoke(input: {
      actorUserId: string;
      inviteId: string;
      reason: string;
      occurredAt: Date;
    }): Promise<void> {
      assertMutationsEnabled(options.mutationsEnabled);
      const reason = RevokeReasonSchema.parse(input.reason);

      await database.transaction(async (tx) => {
        const [actor, invite] = await Promise.all([
          tx.findUser(input.actorUserId),
          tx.findInvite(input.inviteId),
        ]);

        assertActiveAdmin(actor);
        if (!invite) {
          throw new NotFound("teacher_invite_not_found");
        }

        const effectiveStatus = effectiveTeacherInviteStatus({
          status: invite.status,
          expiresAt: invite.expiresAt,
          now: input.occurredAt,
        });
        if (effectiveStatus !== "PENDING" && effectiveStatus !== "EXPIRED") {
          throw new Conflict("teacher_invite_not_pending");
        }

        await tx.revokeInvites({
          inviteIds: [invite.inviteId],
          revokedAt: input.occurredAt,
          revokedByUserId: actor.userId,
          reason,
        });

        await tx.createAuditLog({
          actorId: actor.userId,
          action: "TEACHER_INVITE_REVOKED",
          targetId: invite.inviteId,
          targetLabel: invite.email,
          before: { status: effectiveStatus },
          after: { status: "REVOKED" },
          reason,
          timestamp: input.occurredAt,
        });
      });
    },
  };
}
