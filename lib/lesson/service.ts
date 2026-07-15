import type { Lesson, Prisma } from "@prisma/client";
import { can, type Session } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit/log";
import { db } from "@/lib/db/client";
import { Conflict, Forbidden, NotFound, ValidationError } from "@/lib/errors";
import { TX_OPTS } from "@/lib/assignment/constants";
import { lessonWorkspaceMutationsEnabled } from "./feature-flags";
import {
  canArchiveLesson,
  canDeleteLesson,
  canLinkContentToLesson,
  getLessonArchiveBlockers,
} from "./policy";
import {
  CreateLessonSchema,
  LessonReasonSchema,
  MoveLessonContentSchema,
  ReorderLessonsSchema,
  UpdateLessonSchema,
  type CreateLessonInput,
  type MoveLessonContentInput,
  type ReorderLessonsInput,
  type UpdateLessonInput,
} from "./validation";

export type LessonActorCtx = {
  actorUserId: string;
  ipAddress?: string;
  userAgent?: string;
  env?: NodeJS.ProcessEnv;
};

function teacherSession(actorUserId: string): Session {
  return {
    user: {
      id: actorUserId,
      role: "TEACHER",
      identifier: actorUserId,
      mustResetPwd: false,
    },
  };
}

function assertMutationsEnabled(env?: NodeJS.ProcessEnv) {
  if (!lessonWorkspaceMutationsEnabled(env)) {
    throw new Forbidden("lesson_workspace_mutations_disabled");
  }
}

function assertCanMutate(
  actorUserId: string,
  course: { teacherId: string; archivedAt: Date | null }
) {
  if (!can.mutateLesson(teacherSession(actorUserId), { course })) {
    throw new Forbidden("lesson_mutation_forbidden");
  }
}

export async function createLesson(
  input: CreateLessonInput,
  ctx: LessonActorCtx
): Promise<Lesson> {
  assertMutationsEnabled(ctx.env);
  const parsed = CreateLessonSchema.parse(input);

  return db.$transaction(async (tx) => {
    const course = await tx.courseOffering.findUnique({
      where: { id: parsed.courseOfferingId },
      select: { teacherId: true, archivedAt: true },
    });
    if (!course) throw new NotFound("course_not_found");
    assertCanMutate(ctx.actorUserId, course);

    const last = await tx.lesson.findFirst({
      where: { courseOfferingId: parsed.courseOfferingId },
      orderBy: [{ position: "desc" }, { createdAt: "desc" }],
      select: { position: true },
    });

    return tx.lesson.create({
      data: {
        courseOfferingId: parsed.courseOfferingId,
        title: parsed.title,
        description: parsed.description,
        position: (last?.position ?? -1) + 1,
        createdById: ctx.actorUserId,
      },
    });
  }, TX_OPTS);
}

export async function updateLesson(
  lessonId: string,
  input: UpdateLessonInput,
  ctx: LessonActorCtx
): Promise<Lesson> {
  assertMutationsEnabled(ctx.env);
  const parsed = UpdateLessonSchema.parse(input);

  return db.$transaction(async (tx) => {
    const lesson = await tx.lesson.findUnique({
      where: { id: lessonId },
      select: {
        archivedAt: true,
        course: { select: { teacherId: true, archivedAt: true } },
      },
    });
    if (!lesson) throw new NotFound("lesson_not_found");
    assertCanMutate(ctx.actorUserId, lesson.course);
    if (lesson.archivedAt !== null) throw new Conflict("lesson_archived");

    return tx.lesson.update({
      where: { id: lessonId },
      data: {
        ...(parsed.title !== undefined && { title: parsed.title }),
        ...(parsed.description !== undefined && {
          description: parsed.description,
        }),
      },
    });
  }, TX_OPTS);
}

export async function reorderLessons(
  input: ReorderLessonsInput,
  ctx: LessonActorCtx
): Promise<void> {
  assertMutationsEnabled(ctx.env);
  const parsed = ReorderLessonsSchema.parse(input);
  if (new Set(parsed.lessonIds).size !== parsed.lessonIds.length) {
    throw new ValidationError({ lessonIds: "lesson_ids_must_be_unique" });
  }

  await db.$transaction(async (tx) => {
    const course = await tx.courseOffering.findUnique({
      where: { id: parsed.courseOfferingId },
      select: { teacherId: true, archivedAt: true },
    });
    if (!course) throw new NotFound("course_not_found");
    assertCanMutate(ctx.actorUserId, course);

    const active = await tx.lesson.findMany({
      where: { courseOfferingId: parsed.courseOfferingId, archivedAt: null },
      select: { id: true },
    });
    const activeIds = new Set(active.map((lesson) => lesson.id));
    if (
      activeIds.size !== parsed.lessonIds.length ||
      parsed.lessonIds.some((id) => !activeIds.has(id))
    ) {
      throw new Conflict("lesson_order_out_of_date");
    }

    await Promise.all(
      parsed.lessonIds.map((id, position) =>
        tx.lesson.update({ where: { id }, data: { position } })
      )
    );
  }, TX_OPTS);
}

export async function archiveLesson(
  lessonId: string,
  reasonInput: string,
  ctx: LessonActorCtx
): Promise<void> {
  assertMutationsEnabled(ctx.env);
  const reason = LessonReasonSchema.parse(reasonInput);

  await db.$transaction(async (tx) => {
    const lesson = await tx.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        title: true,
        courseOfferingId: true,
        archivedAt: true,
        course: { select: { teacherId: true, archivedAt: true } },
        assignments: {
          select: {
            submissionClosed: true,
            dueAt: true,
            submissions: { select: { status: true } },
          },
        },
      },
    });
    if (!lesson) throw new NotFound("lesson_not_found");
    assertCanMutate(ctx.actorUserId, lesson.course);
    if (lesson.archivedAt !== null)
      throw new Conflict("lesson_already_archived");

    const blockers = getLessonArchiveBlockers(
      lesson.assignments.map((assignment) => ({
        submissionClosed: assignment.submissionClosed,
        dueAt: assignment.dueAt,
        submissionStatuses: assignment.submissions.map((row) => row.status),
      }))
    );
    if (!canArchiveLesson(blockers)) {
      throw new Conflict(
        blockers.pendingGradingCount > 0
          ? "lesson_has_pending_grading"
          : "lesson_has_open_assignments"
      );
    }

    const archivedAt = new Date();
    await tx.lesson.update({
      where: { id: lessonId },
      data: {
        archivedAt,
        archivedById: ctx.actorUserId,
        archivedReason: reason,
      },
    });
    await audit(
      {
        actorId: ctx.actorUserId,
        actorRole: "TEACHER",
        action: "LESSON_ARCHIVED",
        targetType: "Lesson",
        targetId: lessonId,
        targetLabel: lesson.title,
        reason,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        before: { courseOfferingId: lesson.courseOfferingId, archivedAt: null },
        after: { archivedAt: archivedAt.toISOString() },
      },
      tx
    );
  }, TX_OPTS);
}

export async function deleteEmptyLesson(
  lessonId: string,
  reasonInput: string,
  ctx: LessonActorCtx
): Promise<void> {
  assertMutationsEnabled(ctx.env);
  const reason = LessonReasonSchema.parse(reasonInput);

  await db.$transaction(async (tx) => {
    const lesson = await tx.lesson.findUnique({
      where: { id: lessonId },
      select: {
        title: true,
        courseOfferingId: true,
        course: { select: { teacherId: true, archivedAt: true } },
        _count: { select: { assignments: true, materials: true } },
      },
    });
    if (!lesson) throw new NotFound("lesson_not_found");
    assertCanMutate(ctx.actorUserId, lesson.course);
    if (
      !canDeleteLesson({
        assignmentCount: lesson._count.assignments,
        materialCount: lesson._count.materials,
      })
    ) {
      throw new Conflict("lesson_not_empty");
    }

    await tx.lesson.delete({ where: { id: lessonId } });
    await audit(
      {
        actorId: ctx.actorUserId,
        actorRole: "TEACHER",
        action: "LESSON_DELETED",
        targetType: "Lesson",
        targetId: lessonId,
        targetLabel: lesson.title,
        reason,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        before: {
          courseOfferingId: lesson.courseOfferingId,
          title: lesson.title,
        },
        after: { deleted: true },
      },
      tx
    );
  }, TX_OPTS);
}

export async function moveLessonContent(
  input: MoveLessonContentInput,
  ctx: LessonActorCtx
): Promise<void> {
  assertMutationsEnabled(ctx.env);
  const parsed = MoveLessonContentSchema.parse(input);

  await db.$transaction(async (tx) => {
    const target = await tx.lesson.findUnique({
      where: { id: parsed.targetLessonId },
      select: {
        id: true,
        title: true,
        courseOfferingId: true,
        archivedAt: true,
        course: { select: { teacherId: true, archivedAt: true } },
      },
    });
    if (!target) throw new NotFound("target_lesson_not_found");
    assertCanMutate(ctx.actorUserId, target.course);

    const content = await readContent(tx, parsed.contentType, parsed.contentId);
    if (!content) throw new NotFound("lesson_content_not_found");
    if (
      !canLinkContentToLesson({
        contentCourseOfferingId: content.courseOfferingId,
        lessonCourseOfferingId: target.courseOfferingId,
        lessonArchivedAt: target.archivedAt,
      })
    ) {
      throw new Conflict("lesson_content_target_invalid");
    }
    if (content.lessonId === target.id) {
      throw new Conflict("lesson_content_already_in_target");
    }

    if (parsed.contentType === "ASSIGNMENT") {
      await tx.assignment.update({
        where: { id: content.id },
        data: { lessonId: target.id },
      });
    } else {
      await tx.material.update({
        where: { id: content.id },
        data: { lessonId: target.id },
      });
    }

    await audit(
      {
        actorId: ctx.actorUserId,
        actorRole: "TEACHER",
        action: "LESSON_CONTENT_MOVED",
        targetType:
          parsed.contentType === "ASSIGNMENT" ? "Assignment" : "Material",
        targetId: content.id,
        targetLabel: content.title,
        reason: parsed.reason,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        before: { lessonId: content.lessonId },
        after: { lessonId: target.id, lessonTitle: target.title },
      },
      tx
    );
  }, TX_OPTS);
}

async function readContent(
  tx: Prisma.TransactionClient,
  type: "ASSIGNMENT" | "MATERIAL",
  id: string
) {
  if (type === "ASSIGNMENT") {
    return tx.assignment.findUnique({
      where: { id },
      select: { id: true, title: true, courseOfferingId: true, lessonId: true },
    });
  }
  return tx.material.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, title: true, courseOfferingId: true, lessonId: true },
  });
}
