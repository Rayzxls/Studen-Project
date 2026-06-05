import type { CourseTab } from "@/components/course/tab-nav";

/**
 * Student CourseOffering tab list — Phase 10C reshape per ADR-0025.
 *
 * Mirrors the teacher reshape. Feed becomes the default landing; the
 * three content-type list tabs disappear from the nav (detail routes
 * remain reachable via Feed cards).
 *
 * 7 tabs → 5 tabs.
 */
export const studentCourseTabs = (courseId: string): CourseTab[] => [
  { label: "ฟีด", href: `/student/courses/${courseId}/feed` },
  { label: "ภาพรวม", href: `/student/courses/${courseId}` },
  { label: "เพื่อนร่วมห้อง", href: `/student/courses/${courseId}/members` },
  { label: "เช็คชื่อ", href: `/student/courses/${courseId}/attendance` },
  { label: "คะแนน", href: `/student/courses/${courseId}/scores` },
];
