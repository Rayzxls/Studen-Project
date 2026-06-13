/**
 * Profile mutations — Phase 13 · learning identity (not social media).
 *
 * Three write paths, all audited (CLAUDE.md: every mutation touching user
 * data leaves a trail):
 *
 *   updateDisplayName  — self-service set/clear of User.displayName.
 *                        displayName is friendly-UI-only (dashboard
 *                        greeting, profile heading); real name stays
 *                        authoritative everywhere else.
 *   setProfileImage    — points User.profileImageId at a committed
 *                        PROFILE_IMAGE FileAttachment (client crops to
 *                        512×512 before upload; the original is never
 *                        stored). The previous attachment is soft-deleted.
 *   removeProfileImage — self-delete (PROFILE_IMAGE_DELETED) or admin
 *                        reset of another user (PROFILE_IMAGE_RESET_BY_ADMIN).
 */

import type { Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit/log";
import { TX_OPTS } from "@/lib/assignment/constants";
import { Forbidden, NotFound, ValidationError } from "@/lib/errors";

export const DISPLAY_NAME_MAX = 50;

export interface ActorCtx {
  actorUserId: string;
  actorRole: Role;
  ipAddress?: string;
  userAgent?: string;
}

/** Real-name label for audit targetLabel — falls back to identifier. */
async function userLabel(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<string> {
  const u = await tx.user.findUnique({
    where: { id: userId },
    select: {
      identifier: true,
      admin: { select: { firstName: true, lastName: true } },
      teacher: { select: { firstName: true, lastName: true } },
      student: { select: { firstName: true, lastName: true } },
    },
  });
  if (!u) return userId;
  const p = u.admin ?? u.teacher ?? u.student;
  return p ? `${p.firstName} ${p.lastName}` : u.identifier;
}

// ─────────────────────────────────────────────────────────────

export async function updateDisplayName(
  input: { displayName: string },
  ctx: ActorCtx
): Promise<void> {
  const trimmed = input.displayName.trim();
  if (trimmed.length > DISPLAY_NAME_MAX) {
    throw new ValidationError({
      displayName: `ชื่อที่แสดงยาวได้ไม่เกิน ${DISPLAY_NAME_MAX} ตัวอักษร`,
    });
  }
  const next = trimmed === "" ? null : trimmed;

  await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: ctx.actorUserId },
      select: { displayName: true },
    });
    if (!user) throw new NotFound("user_not_found");
    if (user.displayName === next) return; // no-op, no audit noise

    await tx.user.update({
      where: { id: ctx.actorUserId },
      data: { displayName: next },
    });

    await audit(
      {
        actorId: ctx.actorUserId,
        actorRole: ctx.actorRole,
        action: "DISPLAY_NAME_CHANGED",
        targetType: "User",
        targetId: ctx.actorUserId,
        targetLabel: await userLabel(tx, ctx.actorUserId),
        before: { displayName: user.displayName },
        after: { displayName: next },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
      tx
    );
  }, TX_OPTS);
}

// ─────────────────────────────────────────────────────────────

export async function setProfileImage(
  input: { fileId: string },
  ctx: ActorCtx
): Promise<void> {
  await db.$transaction(async (tx) => {
    // The attachment must be a committed PROFILE_IMAGE in the actor's OWN
    // scope — re-checked here even though presign/commit already gated it
    // (TOCTOU posture mirrors the storage pipeline).
    const file = await tx.fileAttachment.findUnique({
      where: { id: input.fileId },
      select: {
        id: true,
        ownerType: true,
        ownerId: true,
        mimeType: true,
        deletedAt: true,
      },
    });
    if (!file || file.deletedAt) throw new NotFound("file_not_found");
    if (
      file.ownerType !== "PROFILE_IMAGE" ||
      file.ownerId !== ctx.actorUserId
    ) {
      throw new Forbidden("not_your_profile_image");
    }
    if (!file.mimeType.startsWith("image/")) {
      throw new ValidationError({ fileId: "ไฟล์ต้องเป็นรูปภาพ" });
    }

    const user = await tx.user.findUnique({
      where: { id: ctx.actorUserId },
      select: { profileImageId: true },
    });
    if (!user) throw new NotFound("user_not_found");

    // Retire the previous avatar attachment (soft delete — R2 object reaped
    // out-of-band; the pointer swap is what matters for serving).
    if (user.profileImageId && user.profileImageId !== file.id) {
      await tx.fileAttachment.updateMany({
        where: { id: user.profileImageId },
        data: { deletedAt: new Date(), deletedById: ctx.actorUserId },
      });
    }

    await tx.user.update({
      where: { id: ctx.actorUserId },
      data: { profileImageId: file.id },
    });

    await audit(
      {
        actorId: ctx.actorUserId,
        actorRole: ctx.actorRole,
        action: "PROFILE_IMAGE_CHANGED",
        targetType: "User",
        targetId: ctx.actorUserId,
        targetLabel: await userLabel(tx, ctx.actorUserId),
        before: { profileImageId: user.profileImageId },
        after: { profileImageId: file.id },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
      tx
    );
  }, TX_OPTS);
}

// ─────────────────────────────────────────────────────────────

/**
 * Remove an avatar — back to the shared default.
 *
 * Self path: any user clears their own photo (PROFILE_IMAGE_DELETED).
 * Admin path: an ADMIN clears another user's photo from the admin user
 * drill-down (PROFILE_IMAGE_RESET_BY_ADMIN) — moderation, never identity
 * editing. Admin resetting their own photo goes through the self path.
 */
export async function removeProfileImage(
  input: { targetUserId: string },
  ctx: ActorCtx
): Promise<void> {
  const isSelf = input.targetUserId === ctx.actorUserId;
  if (!isSelf && ctx.actorRole !== "ADMIN") {
    throw new Forbidden("not_allowed");
  }

  await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: input.targetUserId },
      select: { profileImageId: true },
    });
    if (!user) throw new NotFound("user_not_found");
    if (!user.profileImageId) return; // already default — no-op

    await tx.fileAttachment.updateMany({
      where: { id: user.profileImageId },
      data: { deletedAt: new Date(), deletedById: ctx.actorUserId },
    });
    await tx.user.update({
      where: { id: input.targetUserId },
      data: { profileImageId: null },
    });

    await audit(
      {
        actorId: ctx.actorUserId,
        actorRole: ctx.actorRole,
        action: isSelf
          ? "PROFILE_IMAGE_DELETED"
          : "PROFILE_IMAGE_RESET_BY_ADMIN",
        targetType: "User",
        targetId: input.targetUserId,
        targetLabel: await userLabel(tx, input.targetUserId),
        before: { profileImageId: user.profileImageId },
        after: { profileImageId: null },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
      tx
    );
  }, TX_OPTS);
}
