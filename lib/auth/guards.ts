import type { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { Forbidden, Unauthorized } from "@/lib/errors";
import { can, type Session } from "@/lib/auth/permissions";

/**
 * Server-side auth guards — wrap NextAuth `auth()` with throw semantics
 *
 * Usage:
 *   const session = await requireAuth();
 *   const session = await requireRole(["ADMIN"]);
 *   await assert.viewAuditLog();
 */

export async function requireAuth(): Promise<Session> {
  const session = await auth();
  if (!session?.user) {
    throw new Unauthorized("not_authenticated");
  }
  return { user: session.user };
}

export async function requireRole(roles: Role[]): Promise<Session> {
  const session = await requireAuth();
  if (!roles.includes(session.user.role)) {
    throw new Forbidden("wrong_role");
  }
  return session;
}

export const assert = {
  async viewAuditLog(): Promise<Session> {
    const s = await requireAuth();
    if (!can.viewAuditLog(s)) throw new Forbidden();
    return s;
  },
  async viewUserData(targetUserId: string): Promise<Session> {
    const s = await requireAuth();
    if (!can.viewUserData(s, targetUserId)) throw new Forbidden();
    return s;
  },
  async importTeachersCSV(): Promise<Session> {
    const s = await requireAuth();
    if (!can.importTeachersCSV(s)) throw new Forbidden();
    return s;
  },
};
