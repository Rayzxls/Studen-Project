import type { Prisma } from "@prisma/client";
import {
  assertIsolatedTestDatabase,
  prepareIsolatedDatabaseEnv,
} from "../tests/helpers/database-safety";
import {
  buildLegacyBackfillPlan,
  legacyLessonId,
  type LegacyBackfillPlan,
} from "../lib/lesson/backfill-plan";
import { audit } from "../lib/audit/log";

const APPLY_CONFIRMATION = "APPLY_LESSON_BACKFILL_TO_ISOLATED_QA";
const BACKFILL_REASON = "B2 compatibility backfill to legacy Lesson";

type PlanClient = Pick<Prisma.TransactionClient, "courseOffering" | "lesson">;
type SnapshotClient = Pick<
  Prisma.TransactionClient,
  | "assignment"
  | "material"
  | "submission"
  | "scoreEntry"
  | "comment"
  | "fileAttachment"
  | "notification"
  | "lesson"
  | "auditLog"
>;

type PreservationSnapshot = {
  assignments: number;
  materials: number;
  submissions: number;
  scoreEntries: number;
  comments: number;
  fileAttachments: number;
  notifications: number;
  lessons: number;
  auditLogs: number;
};

async function loadPlan(db: PlanClient): Promise<LegacyBackfillPlan> {
  const courses = await db.courseOffering.findMany({
    where: {
      OR: [
        { assignments: { some: { lessonId: null } } },
        { materials: { some: { lessonId: null } } },
      ],
    },
    select: {
      id: true,
      teacherId: true,
      lessons: { select: { position: true } },
      _count: {
        select: {
          assignments: { where: { lessonId: null } },
          materials: { where: { lessonId: null } },
        },
      },
    },
    orderBy: { id: "asc" },
  });

  const candidateLessonIds = courses.map((course) => legacyLessonId(course.id));
  const existingLegacyLessons = await db.lesson.findMany({
    where: { id: { in: candidateLessonIds } },
    select: { id: true, courseOfferingId: true, archivedAt: true },
  });
  const lessonById = new Map(
    existingLegacyLessons.map((lesson) => [lesson.id, lesson])
  );

  return buildLegacyBackfillPlan(
    courses.map((course) => {
      const existingLesson = lessonById.get(legacyLessonId(course.id));
      return {
        courseOfferingId: course.id,
        teacherId: course.teacherId,
        lessonPositions: course.lessons.map((lesson) => lesson.position),
        legacyLessonOwnerCourseOfferingId:
          existingLesson?.courseOfferingId ?? null,
        legacyLessonArchivedAt: existingLesson?.archivedAt ?? null,
        unassignedAssignmentCount: course._count.assignments,
        unassignedMaterialCount: course._count.materials,
      };
    })
  );
}

async function snapshot(db: SnapshotClient): Promise<PreservationSnapshot> {
  const [
    assignments,
    materials,
    submissions,
    scoreEntries,
    comments,
    fileAttachments,
    notifications,
    lessons,
    auditLogs,
  ] = await Promise.all([
    db.assignment.count(),
    db.material.count(),
    db.submission.count(),
    db.scoreEntry.count(),
    db.comment.count(),
    db.fileAttachment.count(),
    db.notification.count(),
    db.lesson.count(),
    db.auditLog.count(),
  ]);
  return {
    assignments,
    materials,
    submissions,
    scoreEntries,
    comments,
    fileAttachments,
    notifications,
    lessons,
    auditLogs,
  };
}

function assertPreserved(
  before: PreservationSnapshot,
  after: PreservationSnapshot,
  plan: LegacyBackfillPlan
): void {
  const unchanged: Array<keyof PreservationSnapshot> = [
    "assignments",
    "materials",
    "submissions",
    "scoreEntries",
    "comments",
    "fileAttachments",
    "notifications",
  ];
  for (const key of unchanged) {
    if (before[key] !== after[key]) throw new Error(`count_changed:${key}`);
  }
  if (after.lessons !== before.lessons + plan.summary.lessonsToCreate) {
    throw new Error("lesson_count_mismatch");
  }
  if (after.auditLogs !== before.auditLogs + plan.summary.totalContentLinks) {
    throw new Error("audit_count_mismatch");
  }
}

async function applyPlan(
  db: Prisma.TransactionClient,
  plan: LegacyBackfillPlan
): Promise<void> {
  for (const course of plan.courses) {
    if (course.willCreateLesson) {
      await db.lesson.create({
        data: {
          id: course.legacyLessonId,
          courseOfferingId: course.courseOfferingId,
          title: course.legacyLessonTitle,
          description: course.legacyLessonDescription,
          position: course.legacyLessonPosition,
          createdById: course.teacherId,
        },
      });
    }

    const assignments = await db.assignment.findMany({
      where: { courseOfferingId: course.courseOfferingId, lessonId: null },
      select: { id: true, title: true },
      orderBy: { id: "asc" },
    });
    const assignmentUpdate = await db.assignment.updateMany({
      where: {
        id: { in: assignments.map((assignment) => assignment.id) },
        lessonId: null,
      },
      data: { lessonId: course.legacyLessonId },
    });
    if (assignmentUpdate.count !== assignments.length) {
      throw new Error(
        `assignment_update_count_mismatch:${course.courseOfferingId}`
      );
    }
    for (const assignment of assignments) {
      await audit(
        {
          action: "LESSON_CONTENT_MOVED",
          targetType: "Assignment",
          targetId: assignment.id,
          targetLabel: assignment.title,
          before: { lessonId: null },
          after: { lessonId: course.legacyLessonId },
          reason: BACKFILL_REASON,
        },
        db
      );
    }

    const materials = await db.material.findMany({
      where: { courseOfferingId: course.courseOfferingId, lessonId: null },
      select: { id: true, title: true },
      orderBy: { id: "asc" },
    });
    const materialUpdate = await db.material.updateMany({
      where: {
        id: { in: materials.map((material) => material.id) },
        lessonId: null,
      },
      data: { lessonId: course.legacyLessonId },
    });
    if (materialUpdate.count !== materials.length) {
      throw new Error(
        `material_update_count_mismatch:${course.courseOfferingId}`
      );
    }
    for (const material of materials) {
      await audit(
        {
          action: "LESSON_CONTENT_MOVED",
          targetType: "Material",
          targetId: material.id,
          targetLabel: material.title,
          before: { lessonId: null },
          after: { lessonId: course.legacyLessonId },
          reason: BACKFILL_REASON,
        },
        db
      );
    }
  }
}

async function main(): Promise<void> {
  const applyRequested = process.argv.includes("--apply");
  if (
    applyRequested &&
    process.env.LESSON_BACKFILL_CONFIRM !== APPLY_CONFIRMATION
  ) {
    throw new Error(
      `apply_blocked: set LESSON_BACKFILL_CONFIRM=${APPLY_CONFIRMATION}`
    );
  }

  const isolatedEnv = prepareIsolatedDatabaseEnv(process.env);
  process.env = isolatedEnv;
  assertIsolatedTestDatabase(process.env);

  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();

  try {
    if (!applyRequested) {
      console.log(JSON.stringify(await loadPlan(db), null, 2));
      return;
    }

    const result = await db.$transaction(
      async (tx) => {
        const plan = await loadPlan(tx);
        const before = await snapshot(tx);
        await applyPlan(tx, plan);
        const after = await snapshot(tx);
        assertPreserved(before, after, plan);
        return { plan, before, after };
      },
      { isolationLevel: "Serializable", maxWait: 10_000, timeout: 60_000 }
    );
    const remaining = await loadPlan(db);
    if (remaining.summary.totalContentLinks !== 0) {
      throw new Error("backfill_incomplete");
    }

    console.log(
      JSON.stringify(
        {
          mode: "APPLY",
          applied: result.plan.summary,
          preservation: { before: result.before, after: result.after },
          repeatedRunWouldChange: remaining.summary,
        },
        null,
        2
      )
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "backfill_plan_failed"
  );
  process.exitCode = 1;
});
