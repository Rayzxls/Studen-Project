import type { CourseTab } from "@/components/course/tab-nav";

/**
 * Shared tabs list for the teacher CourseOffering shell (Phase 3).
 *
 * Each tab page imports this rather than re-declaring its own list so that
 * adding a tab is a single-file change. Grows commit-by-commit through P3-5:
 *   commit 1: Overview only
 *   commit 2: + Members
 *   commit 3: + Settings
 */
export const teacherCourseTabs = (courseId: string): CourseTab[] => [
  { label: "ภาพรวม", href: `/teacher/courses/${courseId}` },
  { label: "สมาชิก", href: `/teacher/courses/${courseId}/members` },
  { label: "ตั้งค่า", href: `/teacher/courses/${courseId}/settings` },
];
