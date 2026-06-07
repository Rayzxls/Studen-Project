/**
 * Single Teacher add — Phase 10B Q5.
 *
 * Distinct from `lib/admin/csv-import` (bulk path with mustResetPwd=true
 * for every imported row). This is the "Admin needs to add ONE teacher
 * who joined mid-term" surface from the grill.
 *
 * Same security posture as the CSV path:
 *   - Generate a temp password via lib/admin/temp-password (existing
 *     'TempPass-XXXXXXXX' format teachers already recognise — Phase 2)
 *   - bcrypt-hash + persist + mustResetPwd=true
 *   - Reveal temp password in the action result ONCE (CLAUDE.md hard
 *     rule "Log password → ❌" preserved)
 *   - Audit `TEACHER_CREATED_SINGLE` (Important tier · ADR-0026 § 2 + 4)
 */

import { db } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit/log";
import { Conflict, Forbidden, ValidationError } from "@/lib/errors";
import { generateTempPassword } from "./temp-password";

const TX_OPTS = { maxWait: 10_000, timeout: 15_000 } as const;

export interface CreateSingleTeacherInput {
  email: string;
  firstName: string;
  lastName: string;
}

export interface CreateSingleTeacherResult {
  userId: string;
  tempPassword: string; // reveal-once at the calling Server Action
}

interface AdminCtx {
  actorUserId: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function createSingleTeacher(
  input: CreateSingleTeacherInput,
  ctx: AdminCtx
): Promise<CreateSingleTeacherResult> {
  const email = input.email.trim().toLowerCase();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();

  if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    throw new ValidationError({ email: "อีเมลไม่ถูกต้อง" });
  }
  if (firstName.length === 0) {
    throw new ValidationError({ firstName: "ระบุชื่อ" });
  }
  if (lastName.length === 0) {
    throw new ValidationError({ lastName: "ระบุนามสกุล" });
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const userId = await db.$transaction(async (tx) => {
    const actor = await tx.user.findUnique({
      where: { id: ctx.actorUserId },
      select: { role: true },
    });
    if (!actor || actor.role !== "ADMIN") throw new Forbidden("not_admin");

    const dup = await tx.user.findUnique({ where: { identifier: email } });
    if (dup) throw new Conflict("email_exists");

    const user = await tx.user.create({
      data: {
        identifier: email,
        passwordHash,
        role: "TEACHER",
        mustResetPwd: true,
        isActive: true,
        teacher: {
          create: { email, firstName, lastName },
        },
      },
      select: { id: true },
    });

    await audit(
      {
        actorId: ctx.actorUserId,
        actorRole: "ADMIN",
        action: "TEACHER_CREATED_SINGLE",
        targetType: "User",
        targetId: user.id,
        targetLabel: `${firstName} ${lastName} (${email})`,
        after: {
          email,
          firstName,
          lastName,
          mustResetPwd: true,
        },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
      tx
    );

    return user.id;
  }, TX_OPTS);

  return { userId, tempPassword };
}
