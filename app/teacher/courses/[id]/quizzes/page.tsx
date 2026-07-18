import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, BookOpen, CircleHelp } from "lucide-react";
import { CourseShell } from "@/components/course/course-shell";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import {
  getTeacherQuizSummariesForCourse,
  quizCourseEnabled,
} from "@/lib/quiz";
import { teacherCourseTabs } from "../_tabs";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function TeacherQuizzesPage({ params }: PageProps) {
  const { id } = await params;
  if (!quizCourseEnabled(id)) notFound();
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const [course, quizzes] = await Promise.all([
    getCourseOfferingForTeacher(id, session.user.id),
    getTeacherQuizSummariesForCourse({
      courseOfferingId: id,
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
      <div className="space-y-6 pb-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-700">ศูนย์แบบทดสอบ</p>
            <h1 className="mt-1 text-3xl font-semibold text-ink">
              แบบทดสอบทั้งหมด
            </h1>
            <p className="mt-2 text-sm text-ink-mute">
              ติดตามแบบร่าง แบบที่เปิดให้นักเรียนทำ และรายการที่ปิดแล้วทุกบท
            </p>
          </div>
          <Link
            href={`/teacher/courses/${id}/lessons`}
            className="btn-primary btn-sm w-fit"
          >
            <BookOpen className="h-4 w-4" /> เลือกบทเพื่อสร้าง
          </Link>
        </header>

        {quizzes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-hairline bg-surface px-6 py-16 text-center">
            <CircleHelp className="mx-auto h-8 w-8 text-ink-mute" />
            <h2 className="mt-4 font-semibold text-ink">ยังไม่มีแบบทดสอบ</h2>
            <p className="mt-1 text-sm text-ink-mute">
              เลือกบทเรียนก่อนสร้างแบบทดสอบชิ้นแรก
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-card">
            {quizzes.map((quiz) => (
              <Link
                key={quiz.id}
                href={
                  quiz.status === "DRAFT"
                    ? `/teacher/courses/${id}/quizzes/${quiz.id}`
                    : `/teacher/courses/${id}/quizzes/${quiz.id}/results`
                }
                className="group flex items-center justify-between gap-4 border-b border-hairline px-5 py-4 last:border-0 hover:bg-blue-50/50 hover:no-underline"
              >
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-blue-700">
                    {quiz.lessonTitle}
                  </span>
                  <span className="mt-1 block truncate font-semibold text-ink">
                    {quiz.title}
                  </span>
                  <span className="mt-1 block text-xs text-ink-mute">
                    {quiz.questionCount} ข้อ · {quiz.totalPoints} คะแนน ·{" "}
                    {quiz.mode === "PRACTICE" ? "ฝึกทำ" : "เก็บคะแนน"}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span
                    className={`badge ${quiz.status === "OPEN" ? "badge-success" : quiz.status === "DRAFT" ? "badge-info" : ""}`}
                  >
                    {quiz.status === "DRAFT"
                      ? "ฉบับร่าง"
                      : quiz.status === "OPEN"
                        ? "เปิดทำ"
                        : "ปิดแล้ว"}
                  </span>
                  <ArrowRight className="h-4 w-4 text-ink-mute transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </CourseShell>
  );
}
