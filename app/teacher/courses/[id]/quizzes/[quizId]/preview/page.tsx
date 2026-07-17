import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, ListChecks } from "lucide-react";
import { CourseShell } from "@/components/course/course-shell";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { getTeacherQuizDraft, quizCourseEnabled } from "@/lib/quiz";
import { teacherCourseTabs } from "../../../_tabs";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string; quizId: string }> };

export default async function TeacherQuizPreviewPage({ params }: PageProps) {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }
  const { id, quizId } = await params;
  if (!quizCourseEnabled(id)) notFound();

  const [course, quiz] = await Promise.all([
    getCourseOfferingForTeacher(id, session.user.id),
    getTeacherQuizDraft({
      courseOfferingId: id,
      quizId,
      teacherId: session.user.id,
    }),
  ]);
  if (!course) notFound();
  const totalPoints = quiz.questions.reduce(
    (sum, question) => sum + question.points,
    0
  );

  return (
    <CourseShell
      session={session}
      course={course}
      eyebrow="ตัวอย่างสำหรับนักเรียน"
      backHref="/teacher/courses"
      tabs={teacherCourseTabs(id)}
    >
      <div className="mx-auto max-w-4xl space-y-5">
        <Link
          href={`/teacher/courses/${id}/quizzes/${quizId}`}
          className="btn-ghost btn-sm w-fit"
        >
          <ArrowLeft className="h-4 w-4" /> กลับหน้าแก้ไข
        </Link>
        <header className="border-b border-hairline pb-6">
          <span className="badge">Preview · ไม่สร้าง Attempt</span>
          <h1 className="mt-3 text-2xl font-semibold text-ink md:text-3xl">
            {quiz.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-mute">
            {quiz.description || "ครูยังไม่ได้เพิ่มคำอธิบายแบบทดสอบ"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-ink-mute">
            <span className="badge">
              <ListChecks className="h-3.5 w-3.5" /> {quiz.questions.length} ข้อ
            </span>
            <span className="badge">
              <CheckCircle2 className="h-3.5 w-3.5" /> {totalPoints} คะแนน
            </span>
            {quiz.timeLimitMinutes && (
              <span className="badge">
                <Clock3 className="h-3.5 w-3.5" /> {quiz.timeLimitMinutes} นาที
              </span>
            )}
          </div>
        </header>
        <div className="space-y-4">
          {quiz.questions.map((question, index) => (
            <article
              key={question.id}
              className="rounded-lg border border-hairline bg-surface p-5 shadow-card md:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <span className="text-xs font-medium text-blue-700">
                    คำถามที่ {index + 1}
                  </span>
                  <h2 className="mt-2 text-base font-semibold leading-7 text-ink md:text-lg">
                    {question.prompt}
                  </h2>
                </div>
                <span className="shrink-0 text-xs text-ink-mute">
                  {question.points} คะแนน
                </span>
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {question.options.map((option) => (
                  <div
                    key={option.id}
                    className="flex min-h-12 items-center gap-3 rounded-lg border border-hairline bg-bg/50 px-4 text-sm text-ink"
                  >
                    <span className="h-4 w-4 shrink-0 rounded-full border border-hairline" />
                    {option.text}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </CourseShell>
  );
}
