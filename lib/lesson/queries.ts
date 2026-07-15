import type { Role } from "@prisma/client";
import { can, type Session } from "@/lib/auth/permissions";
import { db } from "@/lib/db/client";
import { Forbidden, NotFound } from "@/lib/errors";
import { lessonWorkspaceEnabled } from "./feature-flags";
import { lessonState, type LessonState } from "./policy";
import { getLessonArchiveBlockers } from "./policy";

export type LessonWorkspaceListItem = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  state: LessonState;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  assignmentCount: number;
  materialCount: number;
};

export type LessonWorkspaceProjection = {
  enabled: boolean;
  courseOfferingId: string;
  lessons: LessonWorkspaceListItem[];
};

export type TeacherLessonDetail = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  state: LessonState;
  archivedAt: Date | null;
  archivedReason: string | null;
  activeStudentCount: number;
  openAssignmentCount: number;
  pendingGradingCount: number;
  assignments: Array<{
    id: string;
    title: string;
    dueAt: Date | null;
    submissionClosed: boolean;
    isScored: boolean;
    fullScore: number | null;
    submittedCount: number;
    missingCount: number;
    lateCount: number;
    pendingGradingCount: number;
  }>;
  materials: Array<{
    id: string;
    title: string;
    body: string;
    postedAt: Date;
  }>;
};

/**
 * Role-safe Lesson list. The Student scope reads only the caller's Enrollment;
 * no peer progress, scores, attendance, or Submission rows are selected.
 */
export async function getLessonWorkspaceForViewer(input: {
  courseOfferingId: string;
  viewer: { id: string; role: Role };
  env?: NodeJS.ProcessEnv;
}): Promise<LessonWorkspaceProjection> {
  if (!lessonWorkspaceEnabled(input.env)) {
    return {
      enabled: false,
      courseOfferingId: input.courseOfferingId,
      lessons: [],
    };
  }

  const course = await db.courseOffering.findUnique({
    where: { id: input.courseOfferingId },
    select: {
      teacherId: true,
      archivedAt: true,
      enrollments: {
        where: { studentId: input.viewer.id },
        select: { studentId: true, removedAt: true },
        take: 1,
      },
    },
  });
  if (!course) throw new NotFound("course_not_found");

  const session: Session = {
    user: {
      id: input.viewer.id,
      role: input.viewer.role,
      identifier: input.viewer.id,
      mustResetPwd: false,
    },
  };
  const enrollment = course.enrollments[0] ?? null;
  if (
    !can.viewLessonWorkspace(session, {
      teacherId: course.teacherId,
      archivedAt: course.archivedAt,
      enrollment,
    })
  ) {
    throw new Forbidden("lesson_workspace_forbidden");
  }

  const rows = await db.lesson.findMany({
    where: { courseOfferingId: input.courseOfferingId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      position: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          assignments: true,
          materials: { where: { deletedAt: null } },
        },
      },
    },
  });

  return {
    enabled: true,
    courseOfferingId: input.courseOfferingId,
    lessons: rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      position: row.position,
      state: lessonState(row),
      archivedAt: row.archivedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      assignmentCount: row._count.assignments,
      materialCount: row._count.materials,
    })),
  };
}

export async function getTeacherLessonDetail(input: {
  courseOfferingId: string;
  lessonId: string;
  teacherId: string;
  env?: NodeJS.ProcessEnv;
}): Promise<TeacherLessonDetail> {
  if (!lessonWorkspaceEnabled(input.env)) {
    throw new NotFound("lesson_workspace_disabled");
  }

  const course = await db.courseOffering.findUnique({
    where: { id: input.courseOfferingId },
    select: {
      teacherId: true,
      archivedAt: true,
      _count: { select: { enrollments: { where: { removedAt: null } } } },
    },
  });
  if (!course) throw new NotFound("course_not_found");
  if (course.teacherId !== input.teacherId || course.archivedAt !== null) {
    throw new Forbidden("lesson_workspace_forbidden");
  }

  const lesson = await db.lesson.findFirst({
    where: { id: input.lessonId, courseOfferingId: input.courseOfferingId },
    select: {
      id: true,
      title: true,
      description: true,
      position: true,
      archivedAt: true,
      archivedReason: true,
      assignments: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          dueAt: true,
          submissionClosed: true,
          isScored: true,
          scoreItem: { select: { fullScore: true } },
          submissions: {
            select: {
              status: true,
              enrollment: { select: { removedAt: true } },
            },
          },
        },
      },
      materials: {
        where: { deletedAt: null },
        orderBy: [{ postedAt: "asc" }, { id: "asc" }],
        select: { id: true, title: true, body: true, postedAt: true },
      },
    },
  });
  if (!lesson) throw new NotFound("lesson_not_found");

  const blockers = getLessonArchiveBlockers(
    lesson.assignments.map((assignment) => ({
      submissionClosed: assignment.submissionClosed,
      dueAt: assignment.dueAt,
      submissionStatuses: assignment.submissions.map((row) => row.status),
    }))
  );

  return {
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    position: lesson.position,
    state: lessonState(lesson),
    archivedAt: lesson.archivedAt,
    archivedReason: lesson.archivedReason,
    activeStudentCount: course._count.enrollments,
    ...blockers,
    assignments: lesson.assignments.map((assignment) => {
      const activeSubmissions = assignment.submissions.filter(
        (row) => row.enrollment.removedAt === null
      );
      const submittedCount = activeSubmissions.filter((row) =>
        ["SUBMITTED", "LATE_SUBMITTED", "GRADED"].includes(row.status)
      ).length;

      return {
        id: assignment.id,
        title: assignment.title,
        dueAt: assignment.dueAt,
        submissionClosed: assignment.submissionClosed,
        isScored: assignment.isScored,
        fullScore: assignment.scoreItem?.fullScore ?? null,
        submittedCount,
        missingCount: Math.max(course._count.enrollments - submittedCount, 0),
        lateCount: activeSubmissions.filter(
          (row) => row.status === "LATE_SUBMITTED"
        ).length,
        pendingGradingCount: activeSubmissions.filter((row) =>
          ["SUBMITTED", "LATE_SUBMITTED"].includes(row.status)
        ).length,
      };
    }),
    materials: lesson.materials,
  };
}
