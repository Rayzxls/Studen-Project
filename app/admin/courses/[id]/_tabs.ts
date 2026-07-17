import type { CourseTab } from "@/components/course/tab-nav";
import { lessonWorkspaceCourseEnabled } from "@/lib/lesson";

export const adminCourseTabs = (courseId: string): CourseTab[] => [
  { label: "ภาพรวม", href: `/admin/courses/${courseId}` },
  { label: "ฟีด", href: `/admin/courses/${courseId}/feed` },
  ...(lessonWorkspaceCourseEnabled(courseId)
    ? [{ label: "บทเรียน", href: `/admin/courses/${courseId}/lessons` }]
    : []),
  { label: "สมาชิก", href: `/admin/courses/${courseId}/members` },
  { label: "เช็คชื่อ", href: `/admin/courses/${courseId}/attendance` },
  { label: "คะแนน", href: `/admin/courses/${courseId}/scores` },
  { label: "งาน", href: `/admin/courses/${courseId}/assignments` },
  { label: "ตั้งค่า", href: `/admin/courses/${courseId}/settings` },
];
