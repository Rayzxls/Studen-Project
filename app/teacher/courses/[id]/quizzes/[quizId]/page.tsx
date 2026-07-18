import { notFound, redirect } from "next/navigation";
import { CourseShell } from "@/components/course/course-shell";
import { TeacherQuizBuilder } from "@/components/quiz/teacher-quiz-builder";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import {
  getTeacherQuizDraft,
  quizCourseEnabled,
  quizCourseMutationsEnabled,
} from "@/lib/quiz";
import { teacherCourseTabs } from "../../_tabs";
import {
  autosaveQuizDraftAction,
  saveAndOpenQuizAction,
  saveQuizDraftAction,
} from "../actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string; quizId: string }>;
  searchParams: Promise<{ notice?: string }>;
};

export default async function TeacherQuizBuilderPage({
  params,
  searchParams,
}: PageProps) {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const { id, quizId } = await params;
  if (!quizCourseEnabled(id)) notFound();
  const { notice } = await searchParams;
  const [course, quiz] = await Promise.all([
    getCourseOfferingForTeacher(id, session.user.id),
    getTeacherQuizDraft({
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
      <TeacherQuizBuilder
        action={saveQuizDraftAction}
        openAction={saveAndOpenQuizAction}
        autosaveAction={autosaveQuizDraftAction}
        notice={notice}
        locked={
          !quizCourseMutationsEnabled(id) ||
          quiz.status !== "DRAFT" ||
          quiz.attemptCount > 0
        }
        initial={{
          quizId: quiz.id,
          courseOfferingId: quiz.courseOfferingId,
          lessonId: quiz.lessonId,
          lessonTitle: quiz.lessonTitle,
          title: quiz.title,
          description: quiz.description ?? "",
          mode: quiz.mode,
          required: quiz.required,
          opensAt: toDateTimeLocal(quiz.opensAt),
          closesAt: toDateTimeLocal(quiz.closesAt),
          timeLimitMinutes: quiz.timeLimitMinutes,
          maxAttempts: quiz.maxAttempts,
          passThresholdPercent: quiz.passThresholdPercent,
          shuffleQuestions: quiz.shuffleQuestions,
          shuffleOptions: quiz.shuffleOptions,
          hideExplanations: quiz.hideExplanations,
          questions: quiz.questions.map((question) => ({
            ...question,
            explanation: question.explanation ?? "",
          })),
        }}
      />
    </CourseShell>
  );
}

function toDateTimeLocal(value: Date | null): string {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
