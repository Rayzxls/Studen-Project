import type { CourseTab } from "@/components/course/tab-nav";
import { lessonWorkspaceCourseEnabled } from "@/lib/lesson";
import { quizCourseEnabled } from "@/lib/quiz";

export const adminCourseTabs = (courseId: string): CourseTab[] => [
  { label: "ภาพรวม", href: `/admin/courses/${courseId}`, icon: "overview" },
  { label: "ฟีด", href: `/admin/courses/${courseId}/feed`, icon: "feed" },
  ...(lessonWorkspaceCourseEnabled(courseId)
    ? [
        {
          label: "บทเรียน",
          href: `/admin/courses/${courseId}/lessons`,
          icon: "lessons" as const,
        },
      ]
    : []),
  ...(quizCourseEnabled(courseId)
    ? [
        {
          label: "แบบทดสอบ",
          href: `/admin/courses/${courseId}/quizzes`,
          icon: "quizzes" as const,
        },
      ]
    : []),
  {
    label: "สมาชิก",
    href: `/admin/courses/${courseId}/members`,
    icon: "members",
  },
  {
    label: "เช็คชื่อ",
    href: `/admin/courses/${courseId}/attendance`,
    icon: "attendance",
  },
  {
    label: "คะแนน",
    href: `/admin/courses/${courseId}/scores`,
    icon: "scores",
  },
  {
    label: "งาน",
    href: `/admin/courses/${courseId}/assignments`,
    icon: "assignments",
  },
  {
    label: "ตั้งค่า",
    href: `/admin/courses/${courseId}/settings`,
    icon: "settings",
  },
];
