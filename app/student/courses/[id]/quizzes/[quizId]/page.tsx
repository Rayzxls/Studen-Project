import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ListChecks,
  Play,
  RotateCcw,
} from "lucide-react";
import { CourseShell } from "@/components/course/course-shell";
import { ReportContentButton } from "@/components/moderation/report-content-button";
import { QuizAttachmentPreview } from "@/components/quiz/quiz-attachment-preview";
import { assert } from "@/lib/auth/guards";
import { getCourseOfferingForStudent } from "@/lib/course/queries";
import { HttpError } from "@/lib/errors";
import {
  getStudentQuizSummary,
  quizCourseEnabled,
  quizCourseMutationsEnabled,
} from "@/lib/quiz";
import { studentCourseTabs } from "../../_tabs";
import { startQuizAttemptAction } from "../actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string; quizId: string }>;
  searchParams: Promise<{ notice?: string }>;
};

export default async function StudentQuizOverviewPage({
  params,
  searchParams,
}: PageProps) {
  const { id, quizId } = await params;
  if (!quizCourseEnabled(id)) notFound();
  let guard;
  try {
    guard = await assert.isActiveCourseMember(id);
  } catch {
    redirect("/dashboard");
  }
  const [{ notice }, course, quiz] = await Promise.all([
    searchParams,
    getCourseOfferingForStudent(id, guard.session.user.id),
    getStudentQuizSummary({
      courseOfferingId: id,
      quizId,
      studentId: guard.session.user.id,
    }),
  ]).catch((error: unknown) => {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  });
  if (!course) notFound();
  const now = new Date();
  const beforeOpen = !!quiz.opensAt && now.getTime() < quiz.opensAt.getTime();
  const afterClose =
    quiz.status === "CLOSED" ||
    (!!quiz.closesAt && now.getTime() >= quiz.closesAt.getTime());
  const canStart = quizCourseMutationsEnabled(id) && !beforeOpen && !afterClose;

  return (
    <CourseShell
      session={guard.session}
      course={course}
      eyebrow="แบบทดสอบ"
      backHref="/dashboard"
      tabs={studentCourseTabs(id)}
    >
      <div className="mx-auto max-w-4xl space-y-6 pb-10">
        <Link
          href={`/student/courses/${id}/lessons/${quiz.lessonId}`}
          className="inline-flex items-center gap-1.5 text-sm text-ink-mute hover:text-blue-700"
        >
          <ArrowLeft className="h-4 w-4" /> กลับไป {quiz.lessonTitle}
        </Link>

        {notice && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {notice}
          </p>
        )}

        <header className="border-b border-hairline pb-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge">
                  {quiz.mode === "PRACTICE" ? "ฝึกทำ" : "มีคะแนน"}
                  {quiz.required && " · ต้องทำ"}
                </span>
                <ReportContentButton
                  targetType="QUIZ"
                  targetId={quiz.id}
                  compact
                />
              </div>
              <h1 className="mt-4 text-2xl font-semibold text-ink md:text-4xl">
                {quiz.title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-mute">
                {quiz.description || "อ่านรายละเอียดให้ครบก่อนเริ่มทำแบบทดสอบ"}
              </p>
            </div>
            {quiz.latestScore !== null && quiz.scoreVisible && (
              <div className="text-right">
                <p className="text-xs text-ink-mute">คะแนนล่าสุด</p>
                <p className="mt-1 text-3xl font-semibold text-blue-700">
                  {quiz.latestScore}/{quiz.totalPoints}
                </p>
              </div>
            )}
          </div>
          <QuizAttachmentPreview attachments={quiz.attachments} />
        </header>

        <section className="grid gap-px overflow-hidden rounded-lg border border-hairline bg-hairline sm:grid-cols-3">
          <Fact
            icon={ListChecks}
            label="จำนวนคำถาม"
            value={`${quiz.questionCount} ข้อ`}
          />
          <Fact
            icon={Clock3}
            label="เวลาทำ"
            value={
              quiz.timeLimitMinutes
                ? `${quiz.timeLimitMinutes} นาที`
                : "ไม่จำกัดเวลา"
            }
          />
          <Fact
            icon={RotateCcw}
            label="ทำแล้ว"
            value={`${quiz.submittedAttemptCount} ครั้ง`}
          />
        </section>

        <section className="flex flex-col gap-4 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-ink">
              {quiz.activeAttemptId
                ? "มีชุดคำตอบที่กำลังทำอยู่"
                : "พร้อมเริ่มหรือยัง?"}
            </h2>
            <p className="mt-1 text-sm text-ink-mute">
              {beforeOpen
                ? `เริ่มได้ ${formatDateTime(quiz.opensAt!)}`
                : afterClose
                  ? "แบบทดสอบนี้ปิดแล้ว"
                  : "คำตอบจะบันทึกอัตโนมัติระหว่างทำ"}
            </p>
          </div>
          {canStart ? (
            <form action={startQuizAttemptAction}>
              <input type="hidden" name="courseId" value={id} />
              <input type="hidden" name="quizId" value={quiz.id} />
              <button type="submit" className="btn-primary w-full sm:w-auto">
                <Play className="h-4 w-4" />
                {quiz.activeAttemptId ? "รับสิทธิ์และทำต่อ" : "เริ่มทำแบบทดสอบ"}
              </button>
            </form>
          ) : (
            <span className="badge">
              <CheckCircle2 className="h-4 w-4" /> ยังเริ่มไม่ได้
            </span>
          )}
        </section>
      </div>
    </CourseShell>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-surface p-5">
      <Icon className="h-5 w-5 text-blue-700" />
      <p className="mt-3 text-xs text-ink-mute">{label}</p>
      <p className="mt-1 font-semibold text-ink">{value}</p>
    </div>
  );
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(value);
}
