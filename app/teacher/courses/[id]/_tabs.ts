import type { CourseTab } from "@/components/course/tab-nav";
import { lessonWorkspaceCourseEnabled } from "@/lib/lesson";
import { quizEnabled } from "@/lib/quiz";

/**
 * Teacher CourseOffering tab list — Phase 10C reshape per ADR-0025.
 *
 * Feed remains the default landing, but assignments are a primary workflow
 * for teachers, so "การบ้าน" stays in the tab bar for direct access to create,
 * edit, delete, and grade assignment work.
 *
 * Detail routes (assignments/[aid]) inherit the active "การบ้าน" tab via
 * prefix matching in TabNav. `icon` is a serializable key (not the
 * component) so this server-built list crosses the RSC boundary safely.
 */
export const teacherCourseTabs = (
  courseId: string,
  scheduledCount?: number
): CourseTab[] => [
  { label: "ฟีด", href: `/teacher/courses/${courseId}/feed`, icon: "feed" },
  {
    label: "กำหนดการ",
    href: `/teacher/courses/${courseId}/schedule`,
    icon: "schedule",
    badge: scheduledCount,
  },
  ...(lessonWorkspaceCourseEnabled(courseId)
    ? [
        {
          label: "บทเรียน",
          href: `/teacher/courses/${courseId}/lessons`,
          icon: "lessons" as const,
        },
      ]
    : []),
  ...(quizEnabled()
    ? [
        {
          label: "แบบทดสอบ",
          href: `/teacher/courses/${courseId}/quizzes`,
          icon: "quizzes" as const,
        },
      ]
    : []),
  {
    label: "การบ้าน",
    href: `/teacher/courses/${courseId}/assignments`,
    icon: "assignments",
  },
  {
    // Its own tab rather than a corner of ภาพรวม: this is where a teacher
    // goes to start a class, so it has to be somewhere they can aim for.
    label: "ห้องออนไลน์",
    href: `/teacher/courses/${courseId}/meeting`,
    icon: "meeting",
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
