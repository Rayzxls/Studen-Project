import type { CourseTab } from "@/components/course/tab-nav";
import { lessonWorkspaceCourseEnabled } from "@/lib/lesson";
import { quizCourseEnabled } from "@/lib/quiz";

/**
 * Student CourseOffering tab list — Phase 10C reshape per ADR-0025.
 *
 * Feed remains the default landing, but assignment submission is a primary
 * student workflow, so "งาน" stays in the tab bar for direct access.
 *
 * Detail routes (assignments/[assignmentId]) inherit the active "งาน" tab
 * via prefix matching in TabNav.
 */
export const studentCourseTabs = (courseId: string): CourseTab[] => [
  { label: "ฟีด", href: `/student/courses/${courseId}/feed` },
  ...(lessonWorkspaceCourseEnabled(courseId)
    ? [{ label: "บทเรียน", href: `/student/courses/${courseId}/lessons` }]
    : []),
  ...(quizCourseEnabled(courseId)
    ? [{ label: "แบบทดสอบ", href: `/student/courses/${courseId}/quizzes` }]
    : []),
  { label: "งาน", href: `/student/courses/${courseId}/assignments` },
  { label: "เพื่อนร่วมห้อง", href: `/student/courses/${courseId}/members` },
  { label: "เช็คชื่อ", href: `/student/courses/${courseId}/attendance` },
  { label: "คะแนน", href: `/student/courses/${courseId}/scores` },
  { label: "ภาพรวม", href: `/student/courses/${courseId}/overview` },
];
