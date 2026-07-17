import { db } from "@/lib/db/client";
import { Forbidden, NotFound } from "@/lib/errors";
import { quizCourseEnabled, type QuizFeatureFlagEnv } from "./feature-flags";

export type TeacherQuizSummary = {
  id: string;
  title: string;
  mode: "PRACTICE" | "SCORED";
  status: "DRAFT" | "OPEN" | "CLOSED";
  questionCount: number;
  totalPoints: number;
  updatedAt: Date;
};

export type TeacherQuizDraftView = {
  id: string;
  courseOfferingId: string;
  lessonId: string;
  lessonTitle: string;
  title: string;
  description: string | null;
  mode: "PRACTICE" | "SCORED";
  status: "DRAFT" | "OPEN" | "CLOSED";
  required: boolean;
  opensAt: Date | null;
  closesAt: Date | null;
  timeLimitMinutes: number | null;
  maxAttempts: number | null;
  passThresholdPercent: number | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  hideExplanations: boolean;
  revision: number;
  attemptCount: number;
  questions: Array<{
    id: string;
    type: "SINGLE_CHOICE" | "MULTIPLE_SELECT" | "TRUE_FALSE";
    prompt: string;
    explanation: string | null;
    points: number;
    options: Array<{
      id: string;
      text: string;
      isCorrect: boolean;
    }>;
  }>;
};

export async function getTeacherQuizSummariesForLesson(input: {
  courseOfferingId: string;
  lessonId: string;
  teacherId: string;
  env?: QuizFeatureFlagEnv;
}): Promise<TeacherQuizSummary[]> {
  assertCourseEnabled(input.courseOfferingId, input.env);

  const rows = await db.quiz.findMany({
    where: {
      courseOfferingId: input.courseOfferingId,
      lessonId: input.lessonId,
      archivedAt: null,
      cancelledAt: null,
      course: { teacherId: input.teacherId, archivedAt: null },
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      mode: true,
      status: true,
      updatedAt: true,
      questions: {
        where: { voidedAt: null },
        select: { points: true },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    mode: row.mode,
    status: row.status,
    questionCount: row.questions.length,
    totalPoints: row.questions.reduce(
      (sum, question) => sum + question.points,
      0
    ),
    updatedAt: row.updatedAt,
  }));
}

export async function getTeacherQuizDraft(input: {
  courseOfferingId: string;
  quizId: string;
  teacherId: string;
  env?: QuizFeatureFlagEnv;
}): Promise<TeacherQuizDraftView> {
  assertCourseEnabled(input.courseOfferingId, input.env);

  const quiz = await db.quiz.findFirst({
    where: {
      id: input.quizId,
      courseOfferingId: input.courseOfferingId,
      archivedAt: null,
      cancelledAt: null,
      course: { teacherId: input.teacherId, archivedAt: null },
    },
    select: {
      id: true,
      courseOfferingId: true,
      lessonId: true,
      title: true,
      description: true,
      mode: true,
      status: true,
      required: true,
      opensAt: true,
      closesAt: true,
      timeLimitMinutes: true,
      maxAttempts: true,
      passThresholdPercent: true,
      shuffleQuestions: true,
      shuffleOptions: true,
      hideExplanations: true,
      revision: true,
      lesson: { select: { title: true, archivedAt: true } },
      _count: { select: { attempts: true } },
      questions: {
        where: { voidedAt: null },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          type: true,
          prompt: true,
          explanation: true,
          points: true,
          options: {
            orderBy: { position: "asc" },
            select: { id: true, text: true, isCorrect: true },
          },
        },
      },
    },
  });
  if (!quiz || quiz.lesson.archivedAt !== null) {
    throw new NotFound("quiz_not_found");
  }

  const { lesson, _count, ...draft } = quiz;
  return {
    ...draft,
    lessonTitle: lesson.title,
    attemptCount: _count.attempts,
    questions: quiz.questions,
  };
}

function assertCourseEnabled(
  courseOfferingId: string,
  env?: QuizFeatureFlagEnv
) {
  if (!quizCourseEnabled(courseOfferingId, env)) {
    throw new Forbidden("quiz_disabled");
  }
}
