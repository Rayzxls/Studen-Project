import { createHash } from "node:crypto";

export const LEGACY_LESSON_TITLE = "เนื้อหาเดิม";
export const LEGACY_LESSON_DESCRIPTION =
  "สร้างอัตโนมัติเพื่อจัดกลุ่มงานและเอกสารเดิมก่อนเปิดใช้พื้นที่บทเรียน";

export type LegacyBackfillCourseInput = {
  courseOfferingId: string;
  teacherId: string;
  lessonPositions: readonly number[];
  legacyLessonOwnerCourseOfferingId: string | null;
  legacyLessonArchivedAt: Date | null;
  unassignedAssignmentCount: number;
  unassignedMaterialCount: number;
};

export type LegacyBackfillCoursePlan = {
  courseOfferingId: string;
  teacherId: string;
  legacyLessonId: string;
  legacyLessonTitle: typeof LEGACY_LESSON_TITLE;
  legacyLessonDescription: typeof LEGACY_LESSON_DESCRIPTION;
  legacyLessonPosition: number;
  willCreateLesson: boolean;
  assignmentsToLink: number;
  materialsToLink: number;
};

export type LegacyBackfillPlan = {
  mode: "DRY_RUN";
  courses: LegacyBackfillCoursePlan[];
  summary: {
    coursesAffected: number;
    lessonsToCreate: number;
    assignmentsToLink: number;
    materialsToLink: number;
    totalContentLinks: number;
  };
};

export function legacyLessonId(courseOfferingId: string): string {
  const digest = createHash("sha256")
    .update(`beagle:legacy-lesson:${courseOfferingId}`)
    .digest("hex")
    .slice(0, 24);
  return `legacy_${digest}`;
}

function nonNegativeInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`invalid_${field}`);
  }
  return value;
}

export function buildLegacyBackfillPlan(
  rows: readonly LegacyBackfillCourseInput[]
): LegacyBackfillPlan {
  const courses = rows
    .map((row): LegacyBackfillCoursePlan | null => {
      const assignmentsToLink = nonNegativeInteger(
        row.unassignedAssignmentCount,
        "assignment_count"
      );
      const materialsToLink = nonNegativeInteger(
        row.unassignedMaterialCount,
        "material_count"
      );
      if (assignmentsToLink + materialsToLink === 0) return null;

      const expectedLessonId = legacyLessonId(row.courseOfferingId);
      if (
        row.legacyLessonOwnerCourseOfferingId !== null &&
        row.legacyLessonOwnerCourseOfferingId !== row.courseOfferingId
      ) {
        throw new Error(`legacy_lesson_id_collision:${expectedLessonId}`);
      }
      if (
        row.legacyLessonOwnerCourseOfferingId !== null &&
        row.legacyLessonArchivedAt !== null
      ) {
        throw new Error(`legacy_lesson_archived:${expectedLessonId}`);
      }

      const maxPosition = row.lessonPositions.reduce(
        (highest, position) => Math.max(highest, position),
        -1
      );

      return {
        courseOfferingId: row.courseOfferingId,
        teacherId: row.teacherId,
        legacyLessonId: expectedLessonId,
        legacyLessonTitle: LEGACY_LESSON_TITLE,
        legacyLessonDescription: LEGACY_LESSON_DESCRIPTION,
        legacyLessonPosition: maxPosition + 1,
        willCreateLesson: row.legacyLessonOwnerCourseOfferingId === null,
        assignmentsToLink,
        materialsToLink,
      };
    })
    .filter((course): course is LegacyBackfillCoursePlan => course !== null)
    .sort((left, right) =>
      left.courseOfferingId.localeCompare(right.courseOfferingId)
    );

  const lessonsToCreate = courses.reduce(
    (total, course) => total + Number(course.willCreateLesson),
    0
  );
  const assignmentsToLink = courses.reduce(
    (total, course) => total + course.assignmentsToLink,
    0
  );
  const materialsToLink = courses.reduce(
    (total, course) => total + course.materialsToLink,
    0
  );

  return {
    mode: "DRY_RUN",
    courses,
    summary: {
      coursesAffected: courses.length,
      lessonsToCreate,
      assignmentsToLink,
      materialsToLink,
      totalContentLinks: assignmentsToLink + materialsToLink,
    },
  };
}
