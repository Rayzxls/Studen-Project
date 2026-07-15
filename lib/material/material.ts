/**
 * Material mutations — Phase 7 · P7-3
 *
 * Mirrors lib/assignment shape, but with no scored coupling. Edit lifecycle
 * is free + Verbose (Q4.2 lock) — only soft-delete logs `MATERIAL_DELETED`
 * Important. Comments under Material are CLASS_WIDE only (Q12.7).
 *
 * Fan-out: `createMaterial` → MATERIAL_POSTED broadcast (Pattern 2 in-tx).
 * Soft-delete: cascade-suppress notifications that reference this Material.
 */

import type { Material, Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit/log";
import { Forbidden, NotFound, ValidationError } from "@/lib/errors";
import {
  fanOutBroadcast,
  suppressNotificationsForDeletedEntity,
} from "@/lib/notification";
import { REASON_MAX, REASON_MIN, TX_OPTS } from "./constants";
import { assertLinkableLesson } from "@/lib/lesson/linking";
import {
  CreateMaterialSchema,
  UpdateMaterialSchema,
  type CreateMaterialInput,
  type UpdateMaterialInput,
} from "./validation";

export interface ActorCtx {
  actorUserId: string;
  ipAddress?: string;
  userAgent?: string;
}

// ─────────────────────────────────────────────────────────────
// createMaterial
// ─────────────────────────────────────────────────────────────

export async function createMaterial(
  input: CreateMaterialInput,
  ctx: ActorCtx
): Promise<Material> {
  const parsed = CreateMaterialSchema.parse(input);

  return db.$transaction(async (tx) => {
    const course = await tx.courseOffering.findUnique({
      where: { id: parsed.courseOfferingId },
      select: { teacherId: true, name: true },
    });
    if (!course) throw new NotFound("course_not_found");
    if (course.teacherId !== ctx.actorUserId) {
      throw new Forbidden("not_course_owner");
    }
    await assertLinkableLesson(tx, {
      lessonId: parsed.lessonId,
      courseOfferingId: parsed.courseOfferingId,
    });

    if (parsed.fileAttachmentIds.length > 0 && !parsed.id) {
      throw new ValidationError({
        fileAttachmentIds: "missing_attachment_owner_id",
      });
    }
    if (parsed.fileAttachmentIds.length > 0 && parsed.id) {
      await assertOwnedFiles(tx, {
        ownerType: "MATERIAL",
        ownerId: parsed.id,
        uploadedById: ctx.actorUserId,
        fileAttachmentIds: parsed.fileAttachmentIds,
      });
    }

    const material = await tx.material.create({
      data: {
        ...(parsed.id && { id: parsed.id }),
        courseOfferingId: parsed.courseOfferingId,
        lessonId: parsed.lessonId ?? null,
        title: parsed.title,
        body: parsed.body,
        fileAttachmentIds: parsed.fileAttachmentIds as Prisma.InputJsonValue,
        linkUrls: parsed.linkUrls as Prisma.InputJsonValue,
        postedById: ctx.actorUserId,
      },
    });

    // P7-3 fan-out — MATERIAL_POSTED broadcast.
    const teacher = await tx.teacher.findUniqueOrThrow({
      where: { userId: ctx.actorUserId },
      select: { firstName: true, lastName: true },
    });
    await fanOutBroadcast(tx, {
      kind: "MATERIAL_POSTED",
      sourceEntityType: "MATERIAL",
      sourceEntityId: material.id,
      courseOfferingId: parsed.courseOfferingId,
      payload: {
        courseId: parsed.courseOfferingId,
        courseName: course.name,
        title: parsed.title,
        postedByName: `${teacher.firstName} ${teacher.lastName}`,
      },
    });

    return material;
  }, TX_OPTS);
}

// ─────────────────────────────────────────────────────────────
// updateMaterial — Verbose, no audit (Q4.2 lock)
// ─────────────────────────────────────────────────────────────

export async function updateMaterial(
  materialId: string,
  patch: UpdateMaterialInput,
  ctx: ActorCtx
): Promise<Material> {
  const parsed = UpdateMaterialSchema.parse(patch);

  return db.$transaction(async (tx) => {
    const current = await tx.material.findUnique({
      where: { id: materialId },
      select: {
        id: true,
        courseOfferingId: true,
        deletedAt: true,
        course: { select: { teacherId: true } },
      },
    });
    if (!current) throw new NotFound("material_not_found");
    if (current.deletedAt !== null) throw new NotFound("material_deleted");
    if (current.course.teacherId !== ctx.actorUserId) {
      throw new Forbidden("not_course_owner");
    }
    if (parsed.lessonId !== undefined) {
      await assertLinkableLesson(tx, {
        lessonId: parsed.lessonId,
        courseOfferingId: current.courseOfferingId,
      });
    }

    return tx.material.update({
      where: { id: materialId },
      data: {
        ...(parsed.lessonId !== undefined && { lessonId: parsed.lessonId }),
        ...(parsed.title !== undefined && { title: parsed.title }),
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

// ─────────────────────────────────────────────────────────────
// softDeleteMaterial — Important audit MATERIAL_DELETED
// ─────────────────────────────────────────────────────────────

export async function softDeleteMaterial(
  materialId: string,
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
    const current = await tx.material.findUnique({
      where: { id: materialId },
      select: {
        id: true,
        courseOfferingId: true,
        title: true,
        deletedAt: true,
        course: { select: { teacherId: true } },
      },
    });
    if (!current) throw new NotFound("material_not_found");
    if (current.deletedAt !== null) {
      throw new ValidationError({ _: "material_already_deleted" });
    }
    if (current.course.teacherId !== ctx.actorUserId) {
      throw new Forbidden("not_course_owner");
    }

    const now = new Date();
    await tx.material.update({
      where: { id: materialId },
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
        action: "MATERIAL_DELETED",
        targetType: "Material",
        targetId: materialId,
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

    // ADR-0022 § 5 cascade — suppress MATERIAL_POSTED notifications
    // referencing this Material so the bell stops linking to a 404.
    await suppressNotificationsForDeletedEntity(tx, {
      sourceEntityType: "MATERIAL",
      sourceEntityId: materialId,
    });
  }, TX_OPTS);
}

async function assertOwnedFiles(
  tx: Prisma.TransactionClient,
  args: {
    ownerType: "MATERIAL";
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
      fileAttachmentIds: `file_not_owned_by_material — ${missing.join(",")}`,
    });
  }
}
