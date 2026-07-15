import type { Role } from "@prisma/client";
import { can, type Session } from "@/lib/auth/permissions";
import { db } from "@/lib/db/client";
import { Forbidden, NotFound } from "@/lib/errors";
import { lessonWorkspaceEnabled } from "./feature-flags";
import { lessonState, type LessonState } from "./policy";

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
