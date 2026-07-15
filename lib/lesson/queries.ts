import type { Role } from "@prisma/client";
import { can, type Session } from "@/lib/auth/permissions";
import { db } from "@/lib/db/client";
import { Forbidden, NotFound } from "@/lib/errors";
import {
  lessonWorkspaceCourseEnabled,
  type FeatureFlagEnv,
} from "./feature-flags";
import { lessonState, type LessonState } from "./policy";
import { getLessonArchiveBlockers } from "./policy";
import {
  buildStudentLessonProjection,
  type StudentLessonWorkspaceProjection,
} from "./student-projection";
import {
  buildAdminLessonProjection,
  type AdminLessonWorkspaceProjection,
} from "./admin-projection";

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
    description: string;
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
  env?: FeatureFlagEnv;
}): Promise<LessonWorkspaceProjection> {
  if (!lessonWorkspaceCourseEnabled(input.courseOfferingId, input.env)) {
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

/**
 * Aggregate-only Admin observer projection. It intentionally excludes
 * Student identity, scores, attendance, Submission versions, comments, and
 * file contents. Detail pages use a separate read-only content projection.
 */
export async function getAdminLessonWorkspace(input: {
  courseOfferingId: string;
  viewer: { id: string; role: Role };
  env?: FeatureFlagEnv;
}): Promise<AdminLessonWorkspaceProjection> {
  if (input.viewer.role !== "ADMIN") {
    throw new Forbidden("lesson_workspace_forbidden");
  }
  if (!lessonWorkspaceCourseEnabled(input.courseOfferingId, input.env)) {
    return {
      enabled: false,
      courseOfferingId: input.courseOfferingId,
      activeStudentCount: 0,
      lessons: [],
    };
  }

  const course = await db.courseOffering.findUnique({
    where: { id: input.courseOfferingId },
    select: {
      _count: { select: { enrollments: { where: { removedAt: null } } } },
    },
  });
  if (!course) throw new NotFound("course_not_found");

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
      _count: {
        select: { materials: { where: { deletedAt: null } } },
      },
      assignments: {
        select: {
          submissions: {
            select: {
              status: true,
              enrollment: { select: { removedAt: true } },
            },
          },
        },
      },
    },
  });
  const activeStudentCount = course._count.enrollments;

  return {
    enabled: true,
    courseOfferingId: input.courseOfferingId,
    activeStudentCount,
    lessons: buildAdminLessonProjection(
      rows.map(({ _count, ...row }) => ({
        ...row,
        materialCount: _count.materials,
      })),
      activeStudentCount
    ),
  };
}

/**
 * Student-only learning path. The nested Submission filter is the L1 privacy
 * boundary: Prisma can return only the current Enrollment's row.
 */
export async function getStudentLessonWorkspace(input: {
  courseOfferingId: string;
  studentId: string;
  env?: FeatureFlagEnv;
  now?: Date;
}): Promise<StudentLessonWorkspaceProjection> {
  if (!lessonWorkspaceCourseEnabled(input.courseOfferingId, input.env)) {
    return {
      enabled: false,
      courseOfferingId: input.courseOfferingId,
      lessons: [],
    };
  }

  const course = await db.courseOffering.findUnique({
    where: { id: input.courseOfferingId },
    select: {
      enrollments: {
        where: { studentId: input.studentId, removedAt: null },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!course) throw new NotFound("course_not_found");
  const enrollment = course.enrollments[0];
  if (!enrollment) throw new Forbidden("lesson_workspace_forbidden");

  const rows = await db.lesson.findMany({
    where: { courseOfferingId: input.courseOfferingId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      position: true,
      archivedAt: true,
      materials: {
        where: { deletedAt: null },
        orderBy: [{ postedAt: "asc" }, { id: "asc" }],
        select: { id: true, title: true, postedAt: true },
      },
      assignments: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          dueAt: true,
          createdAt: true,
          submissions: {
            where: { enrollmentId: enrollment.id },
            select: { status: true },
            take: 1,
          },
        },
      },
    },
  });

  return {
    enabled: true,
    courseOfferingId: input.courseOfferingId,
    lessons: buildStudentLessonProjection(rows, input.now),
  };
}

export async function getTeacherLessonDetail(input: {
  courseOfferingId: string;
  lessonId: string;
  teacherId: string;
  env?: FeatureFlagEnv;
}): Promise<TeacherLessonDetail> {
  if (!lessonWorkspaceCourseEnabled(input.courseOfferingId, input.env)) {
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

  return readLessonDetail({
    courseOfferingId: input.courseOfferingId,
    lessonId: input.lessonId,
    activeStudentCount: course._count.enrollments,
  });
}

export async function getAdminLessonDetail(input: {
  courseOfferingId: string;
  lessonId: string;
  viewer: { id: string; role: Role };
  env?: FeatureFlagEnv;
}): Promise<TeacherLessonDetail> {
  if (input.viewer.role !== "ADMIN") {
    throw new Forbidden("lesson_workspace_forbidden");
  }
  if (!lessonWorkspaceCourseEnabled(input.courseOfferingId, input.env)) {
    throw new NotFound("lesson_workspace_disabled");
  }

  const course = await db.courseOffering.findUnique({
    where: { id: input.courseOfferingId },
    select: {
      _count: { select: { enrollments: { where: { removedAt: null } } } },
    },
  });
  if (!course) throw new NotFound("course_not_found");

  return readLessonDetail({
    courseOfferingId: input.courseOfferingId,
    lessonId: input.lessonId,
    activeStudentCount: course._count.enrollments,
  });
}

async function readLessonDetail(input: {
  courseOfferingId: string;
  lessonId: string;
  activeStudentCount: number;
}): Promise<TeacherLessonDetail> {
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
          description: true,
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
    activeStudentCount: input.activeStudentCount,
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
        description: assignment.description,
        dueAt: assignment.dueAt,
        submissionClosed: assignment.submissionClosed,
        isScored: assignment.isScored,
        fullScore: assignment.scoreItem?.fullScore ?? null,
        submittedCount,
        missingCount: Math.max(input.activeStudentCount - submittedCount, 0),
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
