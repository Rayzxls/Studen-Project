import type { CourseTab } from "@/components/course/tab-nav";

/**
 * Shared tabs list for the student CourseOffering shell (Phase 3 P3-6).
 *
 * Mirrors app/teacher/courses/[id]/_tabs.ts but with fewer tabs — students
 * have no Settings (Class Code controls are teacher-only). Grows commit
 * by commit through P3-6:
 *   commit 1: Overview only
 *   commit 2: + Members
 */
export const studentCourseTabs = (courseId: string): CourseTab[] => [
  { label: "ภาพรวม", href: `/student/courses/${courseId}` },
];
