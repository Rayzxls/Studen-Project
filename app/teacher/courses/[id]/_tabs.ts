import type { CourseTab } from "@/components/course/tab-nav";
import { lessonWorkspaceCourseEnabled } from "@/lib/lesson";
import { quizCourseEnabled } from "@/lib/quiz";

/**
 * Teacher CourseOffering tab list — Phase 10C reshape per ADR-0025.
 *
 * Feed remains the default landing, but assignments are a primary workflow
 * for teachers, so "งาน" stays in the tab bar for direct access to create,
 * edit, delete, and grade assignment work.
 *
 * Detail routes (assignments/[aid]) inherit the active "งาน" tab via
 * prefix matching in TabNav. `icon` is a serializable key (not the
 * component) so this server-built list crosses the RSC boundary safely.
 */
export const teacherCourseTabs = (courseId: string): CourseTab[] => [
  { label: "ฟีด", href: `/teacher/courses/${courseId}/feed`, icon: "feed" },
  ...(lessonWorkspaceCourseEnabled(courseId)
    ? [
        {
          label: "บทเรียน",
          href: `/teacher/courses/${courseId}/lessons`,
          icon: "lessons" as const,
        },
      ]
    : []),
  ...(quizCourseEnabled(courseId)
    ? [
        {
          label: "แบบทดสอบ",
          href: `/teacher/courses/${courseId}/quizzes`,
          icon: "quizzes" as const,
        },
      ]
    : []),
  {
    label: "งาน",
    href: `/teacher/courses/${courseId}/assignments`,
    icon: "assignments",
  },
  {
    label: "สมาชิก",
    href: `/teacher/courses/${courseId}/members`,
    icon: "members",
  },
  {
    label: "เช็คชื่อ",
    href: `/teacher/courses/${courseId}/attendance`,
    icon: "attendance",
  },
  {
    label: "คะแนน",
    href: `/teacher/courses/${courseId}/scores`,
    icon: "scores",
  },
  {
    label: "ตั้งค่า",
    href: `/teacher/courses/${courseId}/settings`,
    icon: "settings",
  },
  {
    label: "ภาพรวม",
    href: `/teacher/courses/${courseId}/overview`,
    icon: "overview",
  },
];
