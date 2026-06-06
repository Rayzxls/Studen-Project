import type { CourseTab } from "@/components/course/tab-nav";

/**
 * Teacher CourseOffering tab list — Phase 10C reshape per ADR-0025.
 *
 * The three content-type list tabs (การบ้าน / เอกสาร / ประกาศ) are removed
 * from the nav; the Feed tab becomes the new default landing and surfaces
 * those activities chronologically with a type-chip filter. The detail
 * routes (assignments/[aid], materials/[mid], announcements/[aid])
 * survive intact and are reached via Feed cards.
 *
 * 8 tabs → 6 tabs.
 */
export const teacherCourseTabs = (courseId: string): CourseTab[] => [
  { label: "ฟีด", href: `/teacher/courses/${courseId}/feed` },
  { label: "สมาชิก", href: `/teacher/courses/${courseId}/members` },
  { label: "เช็คชื่อ", href: `/teacher/courses/${courseId}/attendance` },
  { label: "คะแนน", href: `/teacher/courses/${courseId}/scores` },
  { label: "ตั้งค่า", href: `/teacher/courses/${courseId}/settings` },
  { label: "ภาพรวม", href: `/teacher/courses/${courseId}/overview` },
];
