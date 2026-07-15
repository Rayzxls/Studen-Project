import type { CourseTab } from "@/components/course/tab-nav";
import { lessonWorkspaceEnabled } from "@/lib/lesson";

/**
 * Teacher CourseOffering tab list — Phase 10C reshape per ADR-0025.
 *
 * Feed remains the default landing, but assignments are a primary workflow
 * for teachers, so "งาน" stays in the tab bar for direct access to create,
 * edit, delete, and grade assignment work.
 *
 * Detail routes (assignments/[aid]) inherit the active "งาน" tab via
 * prefix matching in TabNav.
 */
export const teacherCourseTabs = (courseId: string): CourseTab[] => [
  { label: "ฟีด", href: `/teacher/courses/${courseId}/feed` },
  ...(lessonWorkspaceEnabled()
    ? [{ label: "บทเรียน", href: `/teacher/courses/${courseId}/lessons` }]
    : []),
  { label: "งาน", href: `/teacher/courses/${courseId}/assignments` },
  { label: "สมาชิก", href: `/teacher/courses/${courseId}/members` },
  { label: "เช็คชื่อ", href: `/teacher/courses/${courseId}/attendance` },
  { label: "คะแนน", href: `/teacher/courses/${courseId}/scores` },
  { label: "ตั้งค่า", href: `/teacher/courses/${courseId}/settings` },
  { label: "ภาพรวม", href: `/teacher/courses/${courseId}/overview` },
];
