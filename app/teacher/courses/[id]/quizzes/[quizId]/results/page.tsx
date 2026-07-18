import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CourseShell } from "@/components/course/course-shell";
import { TeacherQuizResults } from "@/components/quiz/teacher-quiz-results";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import {
  getTeacherQuizResults,
  quizCourseEnabled,
  quizCourseMutationsEnabled,
} from "@/lib/quiz";
import { teacherCourseTabs } from "../../../_tabs";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string; quizId: string }>;
  searchParams: Promise<{ notice?: string }>;
};

export default async function TeacherQuizResultsPage({
  params,
  searchParams,
}: PageProps) {
  const { id, quizId } = await params;
  const { notice } = await searchParams;
  if (!quizCourseEnabled(id)) notFound();

  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const [course, result] = await Promise.all([
    getCourseOfferingForTeacher(id, session.user.id),
    getTeacherQuizResults({
      courseOfferingId: id,
      quizId,
      teacherId: session.user.id,
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
      <div className="mb-4">
        <Link
          href={`/teacher/courses/${id}/quizzes`}
          className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-blue-700 hover:no-underline"
        >
          <ArrowLeft className="h-4 w-4" /> กลับไปแบบทดสอบทั้งหมด
        </Link>
      </div>
      <TeacherQuizResults
        result={result}
        notice={notice}
        mutationsEnabled={quizCourseMutationsEnabled(id)}
      />
    </CourseShell>
  );
}
