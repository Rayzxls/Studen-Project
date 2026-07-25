import { db } from "@/lib/db/client";
import {
  effectiveTeacherInviteStatus,
  type EffectiveTeacherInviteStatus,
} from "./foundation";

export type TeacherInviteListItem = {
  inviteId: string;
  email: string;
  status: EffectiveTeacherInviteStatus;
  expiresAt: Date;
  createdAt: Date;
};

/**
 * Recent Teacher Invites for the Admin panel, newest first, with the persisted
 * status resolved to its effective value (a PENDING invite past its expiry reads
 * as EXPIRED). Read-only; issuing and revoking go through the audited service.
 */
export async function listRecentTeacherInvites(
  limit = 50,
  now: Date = new Date()
): Promise<TeacherInviteListItem[]> {
  const rows = await db.teacherInvite.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      email: true,
      status: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return rows.map((row) => ({
    inviteId: row.id,
    email: row.email,
    status: effectiveTeacherInviteStatus({
      status: row.status,
      expiresAt: row.expiresAt,
      now,
    }),
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  }));
}
