import { notFound, redirect } from "next/navigation";
import { CourseShell } from "@/components/course/course-shell";
import { TeacherLessonWorkspace } from "@/components/lesson/teacher-lesson-workspace";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import {
  getLessonWorkspaceForViewer,
  lessonWorkspaceCourseEnabled,
  lessonWorkspaceCourseMutationsEnabled,
} from "@/lib/lesson";
import { teacherCourseTabs } from "../_tabs";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
};

export default async function TeacherLessonsPage({
  params,
  searchParams,
}: PageProps) {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;
  if (!lessonWorkspaceCourseEnabled(id)) notFound();

  const { notice } = await searchParams;
  const [course, workspace] = await Promise.all([
    getCourseOfferingForTeacher(id, session.user.id),
    getLessonWorkspaceForViewer({
      courseOfferingId: id,
      viewer: { id: session.user.id, role: session.user.role },
    }),
  ]);
  if (!course) notFound();

  return (
    <CourseShell
      session={session}
      course={course}
      eyebrow="รายวิชาที่สอน"
      backHref="/teacher/courses"
      tabs={teacherCourseTabs(id)}
    >
      <TeacherLessonWorkspace
        courseId={id}
        courseName={course.name}
        canMutate={lessonWorkspaceCourseMutationsEnabled(id)}
        notice={notice}
        lessons={workspace.lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          description: lesson.description,
          assignmentCount: lesson.assignmentCount,
          materialCount: lesson.materialCount,
          state: lesson.state,
        }))}
      />
    </CourseShell>
  );
}
