/**
 * Admin reset-password action — Phase 10B Q1 · ADR-0026 § 2.
 *
 * Generates a temp password, bcrypt-hashes it, persists with
 * mustResetPwd=true + lockout cleared, returns the plaintext for the
 * Server Action to reveal once.
 *
 * CLAUDE.md hard rule preserved: the plaintext temp password is NEVER
 * stored beyond the bcrypt hash, NEVER logged, NEVER in the audit
 * payload. The audit row records the action + the actor + the target
 * + targetLabel snapshot per ADR-0027 but not the secret.
 */

import { db } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit/log";
import { Forbidden, NotFound } from "@/lib/errors";
import { generateTempPassword } from "./temp-password";

const TX_OPTS = { maxWait: 10_000, timeout: 15_000 } as const;

export interface ResetUserPasswordResult {
  /** New temp password — reveal-once at the calling Server Action UI. */
  tempPassword: string;
  /** For convenience: the target's display name used in the reveal banner. */
  targetDisplayName: string;
}

interface AdminCtx {
  actorUserId: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function resetUserPassword(
  targetUserId: string,
  ctx: AdminCtx
): Promise<ResetUserPasswordResult> {
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const targetDisplayName = await db.$transaction(async (tx) => {
    const actor = await tx.user.findUnique({
      where: { id: ctx.actorUserId },
      select: { role: true },
    });
    if (!actor || actor.role !== "ADMIN") throw new Forbidden("not_admin");

    const target = await tx.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        identifier: true,
        role: true,
        mustResetPwd: true,
        teacher: { select: { firstName: true, lastName: true, email: true } },
        student: {
          select: { firstName: true, lastName: true, studentId: true },
        },
      },
    });
    if (!target) throw new NotFound("user_not_found");
    // Admins can reset Admin passwords too — but not for themselves
    // (forces a one-Admin-resets-another posture so the action stays
    // attributable).
    if (target.id === ctx.actorUserId) throw new Forbidden("self_reset");

    await tx.user.update({
      where: { id: targetUserId },
      data: {
        passwordHash,
        mustResetPwd: true,
      },
    });

    const display = displayNameFor(target);
    await audit(
      {
        actorId: ctx.actorUserId,
        actorRole: "ADMIN",
        action: "PASSWORD_RESET_BY_ADMIN",
        targetType: "User",
        targetId: targetUserId,
        targetLabel: display,
        // NB: plaintext password intentionally absent.
        before: { mustResetPwd: target.mustResetPwd },
        after: { mustResetPwd: true },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
      tx
    );

    return display;
  }, TX_OPTS);

  return { tempPassword, targetDisplayName };
}

function displayNameFor(target: {
  identifier: string;
  teacher: { firstName: string; lastName: string; email: string } | null;
  student: {
    firstName: string;
    lastName: string;
    studentId: string;
  } | null;
}): string {
  if (target.teacher) {
    return `${target.teacher.firstName} ${target.teacher.lastName} (${target.teacher.email})`;
  }
  if (target.student) {
    return `${target.student.firstName} ${target.student.lastName} (${target.student.studentId})`;
  }
  return target.identifier;
}
