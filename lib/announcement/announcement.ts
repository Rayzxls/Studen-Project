/**
 * Announcement mutations — Phase 7 · P7-3
 *
 * Mirrors lib/material — same edit-free + Verbose posture (Q4.2),
 * Important audit only on soft-delete. Title is optional (Q4.1 = b).
 */

import type { Announcement, Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit/log";
import { Forbidden, NotFound, ValidationError } from "@/lib/errors";
import {
  clipExcerpt,
  fanOutBroadcast,
  suppressNotificationsForDeletedEntity,
} from "@/lib/notification";
import { REASON_MAX, REASON_MIN, TX_OPTS } from "./constants";
import {
  CreateAnnouncementSchema,
  UpdateAnnouncementSchema,
  type CreateAnnouncementInput,
  type UpdateAnnouncementInput,
} from "./validation";

export interface ActorCtx {
  actorUserId: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAnnouncement(
  input: CreateAnnouncementInput,
  ctx: ActorCtx
): Promise<Announcement> {
  const parsed = CreateAnnouncementSchema.parse(input);

  return db.$transaction(async (tx) => {
    const course = await tx.courseOffering.findUnique({
      where: { id: parsed.courseOfferingId },
      select: { teacherId: true, name: true },
    });
    if (!course) throw new NotFound("course_not_found");
    if (course.teacherId !== ctx.actorUserId) {
      throw new Forbidden("not_course_owner");
    }

    if (parsed.fileAttachmentIds.length > 0 && !parsed.id) {
      throw new ValidationError({
        fileAttachmentIds: "missing_attachment_owner_id",
      });
    }
    if (parsed.fileAttachmentIds.length > 0 && parsed.id) {
      await assertOwnedFiles(tx, {
        ownerType: "ANNOUNCEMENT",
        ownerId: parsed.id,
        uploadedById: ctx.actorUserId,
        fileAttachmentIds: parsed.fileAttachmentIds,
      });
    }

    const announcement = await tx.announcement.create({
      data: {
        ...(parsed.id && { id: parsed.id }),
        courseOfferingId: parsed.courseOfferingId,
        title: parsed.title,
        body: parsed.body,
        fileAttachmentIds: parsed.fileAttachmentIds as Prisma.InputJsonValue,
        linkUrls: parsed.linkUrls as Prisma.InputJsonValue,
        postedById: ctx.actorUserId,
      },
    });

    const teacher = await tx.teacher.findUniqueOrThrow({
      where: { userId: ctx.actorUserId },
      select: { firstName: true, lastName: true },
    });
    await fanOutBroadcast(tx, {
      kind: "ANNOUNCEMENT_POSTED",
      sourceEntityType: "ANNOUNCEMENT",
      sourceEntityId: announcement.id,
      courseOfferingId: parsed.courseOfferingId,
      payload: {
        courseId: parsed.courseOfferingId,
        courseName: course.name,
        title: parsed.title,
        bodyExcerpt: clipExcerpt(parsed.body),
        postedByName: `${teacher.firstName} ${teacher.lastName}`,
      },
    });

    return announcement;
  }, TX_OPTS);
}

export async function updateAnnouncement(
  announcementId: string,
  patch: UpdateAnnouncementInput,
  ctx: ActorCtx
): Promise<Announcement> {
  const parsed = UpdateAnnouncementSchema.parse(patch);

  return db.$transaction(async (tx) => {
    const current = await tx.announcement.findUnique({
      where: { id: announcementId },
      select: {
        id: true,
        deletedAt: true,
        course: { select: { teacherId: true } },
      },
    });
    if (!current) throw new NotFound("announcement_not_found");
    if (current.deletedAt !== null) throw new NotFound("announcement_deleted");
    if (current.course.teacherId !== ctx.actorUserId) {
      throw new Forbidden("not_course_owner");
    }

    return tx.announcement.update({
      where: { id: announcementId },
      data: {
        ...(parsed.title !== undefined && {
          title: parsed.title?.trim() ? parsed.title.trim() : null,
        }),
        ...(parsed.body !== undefined && { body: parsed.body }),
        ...(parsed.fileAttachmentIds !== undefined && {
          fileAttachmentIds: parsed.fileAttachmentIds as Prisma.InputJsonValue,
        }),
        ...(parsed.linkUrls !== undefined && {
          linkUrls: parsed.linkUrls as Prisma.InputJsonValue,
        }),
      },
    });
  }, TX_OPTS);
}

export async function softDeleteAnnouncement(
  announcementId: string,
  ctx: ActorCtx & { reason: string }
): Promise<void> {
  const reason = ctx.reason.trim();
  if (reason.length < REASON_MIN) {
    throw new ValidationError({
      reason: `เหตุผลสั้นเกินไป (อย่างน้อย ${REASON_MIN} ตัวอักษร)`,
    });
  }
  if (reason.length > REASON_MAX) {
    throw new ValidationError({
      reason: `เหตุผลยาวเกินไป (ไม่เกิน ${REASON_MAX} ตัวอักษร)`,
    });
  }

  await db.$transaction(async (tx) => {
    const current = await tx.announcement.findUnique({
      where: { id: announcementId },
      select: {
        id: true,
        courseOfferingId: true,
        title: true,
        deletedAt: true,
        course: { select: { teacherId: true } },
      },
    });
    if (!current) throw new NotFound("announcement_not_found");
    if (current.deletedAt !== null) {
      throw new ValidationError({ _: "announcement_already_deleted" });
    }
    if (current.course.teacherId !== ctx.actorUserId) {
      throw new Forbidden("not_course_owner");
    }

    const now = new Date();
    await tx.announcement.update({
      where: { id: announcementId },
      data: {
        deletedAt: now,
        deletedById: ctx.actorUserId,
        deletedReason: reason,
      },
    });

    await audit(
      {
        actorId: ctx.actorUserId,
        actorRole: "TEACHER",
        action: "ANNOUNCEMENT_DELETED",
        targetType: "Announcement",
        targetId: announcementId,
        reason,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        before: {
          courseOfferingId: current.courseOfferingId,
          title: current.title,
        },
        after: { deletedAt: now.toISOString() },
      },
      tx
    );

    await suppressNotificationsForDeletedEntity(tx, {
      sourceEntityType: "ANNOUNCEMENT",
      sourceEntityId: announcementId,
    });
  }, TX_OPTS);
}

async function assertOwnedFiles(
  tx: Prisma.TransactionClient,
  args: {
    ownerType: "ANNOUNCEMENT";
    ownerId: string;
    uploadedById: string;
    fileAttachmentIds: string[];
  }
): Promise<void> {
  const rows = await tx.fileAttachment.findMany({
    where: {
      id: { in: args.fileAttachmentIds },
      ownerType: args.ownerType,
      ownerId: args.ownerId,
      uploadedById: args.uploadedById,
      deletedAt: null,
    },
    select: { id: true },
  });
  const found = new Set(rows.map((r) => r.id));
  const missing = args.fileAttachmentIds.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new ValidationError({
      fileAttachmentIds: `file_not_owned_by_announcement — ${missing.join(",")}`,
    });
  }
}
