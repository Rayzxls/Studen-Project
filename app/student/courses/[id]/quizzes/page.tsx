import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, CircleHelp, Clock3 } from "lucide-react";
import { CourseShell } from "@/components/course/course-shell";
import { assert } from "@/lib/auth/guards";
import { getCourseOfferingForStudent } from "@/lib/course/queries";
import {
  getStudentQuizSummariesForCourse,
  quizCourseEnabled,
} from "@/lib/quiz";
import { studentCourseTabs } from "../_tabs";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function StudentQuizzesPage({ params }: PageProps) {
  const { id } = await params;
  if (!quizCourseEnabled(id)) notFound();
  let guard;
  try {
    guard = await assert.isActiveCourseMember(id);
  } catch {
    redirect("/dashboard");
  }

  const [course, quizzes] = await Promise.all([
    getCourseOfferingForStudent(id, guard.session.user.id),
    getStudentQuizSummariesForCourse({
      courseOfferingId: id,
      studentId: guard.session.user.id,
    }),
  ]);
  if (!course) notFound();

  return (
    <CourseShell
      session={guard.session}
      course={course}
      eyebrow="วิชาที่เรียน"
      backHref="/dashboard"
      tabs={studentCourseTabs(id)}
    >
      <div className="space-y-6 pb-10">
        <header>
          <p className="text-sm font-medium text-blue-700">ศูนย์แบบทดสอบ</p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">
            แบบทดสอบของฉัน
          </h1>
          <p className="mt-2 text-sm text-ink-mute">
            ดูแบบฝึกหัด แบบเก็บคะแนน และงานที่กำลังทำต่อได้จากที่เดียว
          </p>
        </header>

        {quizzes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-hairline bg-surface px-6 py-16 text-center">
            <CircleHelp className="mx-auto h-8 w-8 text-ink-mute" />
            <h2 className="mt-4 font-semibold text-ink">ยังไม่มีแบบทดสอบ</h2>
            <p className="mt-1 text-sm text-ink-mute">
              เมื่อครูเปิดแบบทดสอบ รายการจะปรากฏที่หน้านี้
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {quizzes.map((quiz) => (
              <Link
                key={quiz.id}
                href={`/student/courses/${id}/quizzes/${quiz.id}`}
                className="group rounded-lg border border-hairline bg-surface p-5 shadow-card transition-colors hover:border-blue-300 hover:no-underline"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-blue-700">
                      {quiz.lessonTitle}
                    </p>
                    <h2 className="mt-1 truncate text-lg font-semibold text-ink">
                      {quiz.title}
                    </h2>
                    <p className="mt-2 text-sm text-ink-mute">
                      {quiz.questionCount} ข้อ · {quiz.totalPoints} คะแนน ·{" "}
                      {quiz.mode === "PRACTICE" ? "ฝึกทำ" : "เก็บคะแนน"}
                    </p>
                  </div>
                  <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-ink-mute transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-hairline pt-4 text-xs">
                  {quiz.activeAttemptId ? (
                    <span className="badge badge-info">กำลังทำ</span>
                  ) : quiz.scoreVisible && quiz.latestScore !== null ? (
                    <span className="badge badge-success">
                      {quiz.latestScore}/{quiz.totalPoints} คะแนน
                    </span>
                  ) : (
                    <span className="badge">
                      {quiz.status === "OPEN" ? "พร้อมทำ" : "ปิดแล้ว"}
                    </span>
                  )}
                  {quiz.timeLimitMinutes && (
                    <span className="inline-flex items-center gap-1 text-ink-mute">
                      <Clock3 className="h-3.5 w-3.5" /> {quiz.timeLimitMinutes}{" "}
                      นาที
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </CourseShell>
  );
}
