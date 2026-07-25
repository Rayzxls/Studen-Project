import { db } from "@/lib/db/client";
import {
  effectiveTeacherInviteStatus,
  hashIdentityToken,
  type EffectiveTeacherInviteStatus,
} from "./foundation";

export type TeacherInvitePreview = {
  email: string;
  status: EffectiveTeacherInviteStatus;
};

/**
 * Resolves a raw invite token to the invited email and its effective status for
 * the `/invite/<token>` landing page. The token is looked up by hash — never
 * stored or compared raw — and only the invited email is returned, which the
 * link holder already possesses. Returns null when no invite matches, so a
 * bad or revoked link cannot be told apart from a made-up one. Read-only; the
 * acceptance itself runs through the audited onboarding service.
 */
export async function findTeacherInviteByToken(
  rawToken: string,
  now: Date = new Date()
): Promise<TeacherInvitePreview | null> {
  const trimmed = rawToken.trim();
  if (trimmed.length < 32 || trimmed.length > 512) return null;

  const invite = await db.teacherInvite.findUnique({
    where: { tokenHash: hashIdentityToken(trimmed) },
    select: { email: true, status: true, expiresAt: true },
  });
  if (!invite) return null;

  return {
    email: invite.email,
    status: effectiveTeacherInviteStatus({
      status: invite.status,
      expiresAt: invite.expiresAt,
      now,
    }),
  };
}

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
