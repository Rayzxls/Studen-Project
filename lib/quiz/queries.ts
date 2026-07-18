import { db } from "@/lib/db/client";
import { Forbidden, NotFound } from "@/lib/errors";
import { quizCourseEnabled, type QuizFeatureFlagEnv } from "./feature-flags";
import { selectBestAttempt } from "./policy";

export type TeacherQuizSummary = {
  id: string;
  lessonId: string;
  lessonTitle: string;
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

export type TeacherQuizResultsView = {
  id: string;
  courseOfferingId: string;
  lessonId: string;
  lessonTitle: string;
  title: string;
  mode: "PRACTICE" | "SCORED";
  status: "OPEN" | "CLOSED";
  closesAt: Date | null;
  passThresholdPercent: number | null;
  totalPoints: number;
  publishedAt: Date | null;
  counts: {
    total: number;
    notStarted: number;
    inProgress: number;
    submitted: number;
  };
  metrics: {
    average: number | null;
    highest: number | null;
    lowest: number | null;
    passCount: number;
    passRate: number | null;
    averageDurationSeconds: number | null;
  };
  students: Array<{
    enrollmentId: string;
    studentUserId: string;
    studentCode: string;
    name: string;
    status: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED";
    attemptCount: number;
    bestScore: number | null;
    latestSubmittedAt: Date | null;
    exception: {
      extendedDeadline: Date | null;
      extraAttempts: number;
    } | null;
    attempts: Array<{
      id: string;
      attemptNumber: number;
      status: "IN_PROGRESS" | "SUBMITTED" | "AUTO_SUBMITTED";
      startedAt: Date;
      submittedAt: Date | null;
      finalScore: number | null;
    }>;
  }>;
  questions: Array<{
    id: string;
    position: number;
    prompt: string;
    points: number;
    answeredCount: number;
    correctCount: number;
    correctRate: number | null;
  }>;
};

export type StudentQuizSummary = {
  id: string;
  courseOfferingId: string;
  lessonId: string;
  lessonTitle: string;
  title: string;
  description: string | null;
  mode: "PRACTICE" | "SCORED";
  status: "OPEN" | "CLOSED";
  required: boolean;
  opensAt: Date | null;
  closesAt: Date | null;
  timeLimitMinutes: number | null;
  maxAttempts: number | null;
  questionCount: number;
  totalPoints: number;
  activeAttemptId: string | null;
  submittedAttemptCount: number;
  latestScore: number | null;
  scoreVisible: boolean;
};

export async function getTeacherQuizSummariesForLesson(input: {
  courseOfferingId: string;
  lessonId: string;
  teacherId: string;
  env?: QuizFeatureFlagEnv;
}): Promise<TeacherQuizSummary[]> {
  return getTeacherQuizSummaries(input);
}

export async function getTeacherQuizSummariesForCourse(input: {
  courseOfferingId: string;
  teacherId: string;
  env?: QuizFeatureFlagEnv;
}): Promise<TeacherQuizSummary[]> {
  return getTeacherQuizSummaries(input);
}

async function getTeacherQuizSummaries(input: {
  courseOfferingId: string;
  lessonId?: string;
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
      lessonId: true,
      title: true,
      mode: true,
      status: true,
      updatedAt: true,
      lesson: { select: { title: true } },
      questions: {
        where: { voidedAt: null },
        select: { points: true },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    lessonId: row.lessonId,
    lessonTitle: row.lesson.title,
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

export async function getTeacherQuizResults(input: {
  courseOfferingId: string;
  quizId: string;
  teacherId: string;
  env?: QuizFeatureFlagEnv;
}): Promise<TeacherQuizResultsView> {
  assertCourseEnabled(input.courseOfferingId, input.env);

  const quiz = await db.quiz.findFirst({
    where: {
      id: input.quizId,
      courseOfferingId: input.courseOfferingId,
      status: { in: ["OPEN", "CLOSED"] },
      archivedAt: null,
      cancelledAt: null,
      course: { teacherId: input.teacherId, archivedAt: null },
      lesson: { archivedAt: null },
    },
    select: {
      id: true,
      courseOfferingId: true,
      lessonId: true,
      title: true,
      mode: true,
      status: true,
      closesAt: true,
      passThresholdPercent: true,
      lesson: { select: { title: true } },
      scoreItem: {
        select: {
          publishedAt: true,
          entries: { select: { enrollmentId: true, value: true } },
        },
      },
      questions: {
        where: { voidedAt: null },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: { id: true, position: true, prompt: true, points: true },
      },
      studentExceptions: {
        select: {
          enrollmentId: true,
          extendedDeadline: true,
          extraAttempts: true,
        },
      },
      attempts: {
        orderBy: [{ enrollmentId: "asc" }, { attemptNumber: "asc" }],
        select: {
          id: true,
          enrollmentId: true,
          attemptNumber: true,
          status: true,
          startedAt: true,
          submittedAt: true,
          finalScore: true,
          answers: {
            select: { questionId: true, isCorrect: true },
          },
        },
      },
      course: {
        select: {
          enrollments: {
            where: { removedAt: null },
            orderBy: [
              { student: { firstName: "asc" } },
              { student: { lastName: "asc" } },
            ],
            select: {
              id: true,
              studentId: true,
              student: {
                select: {
                  studentId: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!quiz) throw new NotFound("quiz_not_found");

  const attemptsByEnrollment = new Map<string, typeof quiz.attempts>();
  for (const attempt of quiz.attempts) {
    const rows = attemptsByEnrollment.get(attempt.enrollmentId) ?? [];
    rows.push(attempt);
    attemptsByEnrollment.set(attempt.enrollmentId, rows);
  }
  const exceptionByEnrollment = new Map(
    quiz.studentExceptions.map((exception) => [
      exception.enrollmentId,
      exception,
    ])
  );
  const publishedScoreByEnrollment = new Map(
    (quiz.scoreItem?.entries ?? []).map((entry) => [
      entry.enrollmentId,
      entry.value,
    ])
  );
  const resultsPublished = quiz.scoreItem?.publishedAt != null;
  const bestAttemptByEnrollment = new Map<
    string,
    (typeof quiz.attempts)[number]
  >();
  const studentRows = quiz.course.enrollments.map((enrollment) => {
    const attempts = attemptsByEnrollment.get(enrollment.id) ?? [];
    const best = selectBestAttempt(
      attempts.map((attempt) => ({
        ...attempt,
        score: attempt.finalScore ?? 0,
        submittedAtMs: attempt.submittedAt?.getTime() ?? null,
      }))
    );
    if (best) bestAttemptByEnrollment.set(enrollment.id, best);
    const active = attempts.some((attempt) => attempt.status === "IN_PROGRESS");
    const latestSubmittedAt = attempts.reduce<Date | null>(
      (latest, attempt) => {
        if (!attempt.submittedAt) return latest;
        return !latest || attempt.submittedAt > latest
          ? attempt.submittedAt
          : latest;
      },
      null
    );
    const exception = exceptionByEnrollment.get(enrollment.id);
    return {
      enrollmentId: enrollment.id,
      studentUserId: enrollment.studentId,
      studentCode: enrollment.student.studentId,
      name: `${enrollment.student.firstName} ${enrollment.student.lastName}`.trim(),
      status: active
        ? ("IN_PROGRESS" as const)
        : best
          ? ("SUBMITTED" as const)
          : ("NOT_STARTED" as const),
      attemptCount: attempts.length,
      bestScore: resultsPublished
        ? (publishedScoreByEnrollment.get(enrollment.id) ?? 0)
        : (best?.finalScore ?? null),
      latestSubmittedAt,
      exception: exception
        ? {
            extendedDeadline: exception.extendedDeadline,
            extraAttempts: exception.extraAttempts,
          }
        : null,
      attempts: attempts.map((attempt) => ({
        id: attempt.id,
        attemptNumber: attempt.attemptNumber,
        status: attempt.status,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        finalScore: attempt.finalScore,
      })),
    };
  });

  const submittedBest = [...bestAttemptByEnrollment.values()];
  const scores = resultsPublished
    ? quiz.course.enrollments.map(
        (enrollment) => publishedScoreByEnrollment.get(enrollment.id) ?? 0
      )
    : submittedBest.map((attempt) => attempt.finalScore ?? 0);
  const threshold = quiz.passThresholdPercent;
  const totalPoints = quiz.questions.reduce(
    (sum, question) => sum + question.points,
    0
  );
  const passCount =
    threshold === null || totalPoints === 0
      ? 0
      : scores.filter((score) => (score / totalPoints) * 100 >= threshold)
          .length;
  const durations = submittedBest
    .filter((attempt) => attempt.submittedAt !== null)
    .map((attempt) =>
      Math.max(
        0,
        Math.round(
          ((attempt.submittedAt?.getTime() ?? attempt.startedAt.getTime()) -
            attempt.startedAt.getTime()) /
            1000
        )
      )
    );

  return {
    id: quiz.id,
    courseOfferingId: quiz.courseOfferingId,
    lessonId: quiz.lessonId,
    lessonTitle: quiz.lesson.title,
    title: quiz.title,
    mode: quiz.mode,
    status: quiz.status === "OPEN" ? "OPEN" : "CLOSED",
    closesAt: quiz.closesAt,
    passThresholdPercent: threshold,
    totalPoints,
    publishedAt: quiz.scoreItem?.publishedAt ?? null,
    counts: {
      total: studentRows.length,
      notStarted: studentRows.filter(
        (student) => student.status === "NOT_STARTED"
      ).length,
      inProgress: studentRows.filter(
        (student) => student.status === "IN_PROGRESS"
      ).length,
      submitted: studentRows.filter((student) => student.status === "SUBMITTED")
        .length,
    },
    metrics: {
      average:
        scores.length > 0
          ? Math.round(
              (scores.reduce((sum, score) => sum + score, 0) / scores.length) *
                100
            ) / 100
          : null,
      highest: scores.length > 0 ? Math.max(...scores) : null,
      lowest: scores.length > 0 ? Math.min(...scores) : null,
      passCount,
      passRate:
        threshold !== null && scores.length > 0
          ? Math.round((passCount / scores.length) * 100)
          : null,
      averageDurationSeconds:
        durations.length > 0
          ? Math.round(
              durations.reduce((sum, seconds) => sum + seconds, 0) /
                durations.length
            )
          : null,
    },
    students: studentRows,
    questions: quiz.questions.map((question) => {
      const answers = submittedBest
        .map((attempt) =>
          attempt.answers.find((answer) => answer.questionId === question.id)
        )
        .filter((answer) => answer !== undefined && answer.isCorrect !== null);
      const correctCount = answers.filter((answer) => answer?.isCorrect).length;
      return {
        id: question.id,
        position: question.position,
        prompt: question.prompt,
        points: question.points,
        answeredCount: answers.length,
        correctCount,
        correctRate:
          answers.length > 0
            ? Math.round((correctCount / answers.length) * 100)
            : null,
      };
    }),
  };
}

export async function getStudentQuizSummariesForLesson(input: {
  courseOfferingId: string;
  lessonId: string;
  studentId: string;
  env?: QuizFeatureFlagEnv;
}): Promise<StudentQuizSummary[]> {
  return getStudentQuizSummaries(input);
}

export async function getStudentQuizSummariesForCourse(input: {
  courseOfferingId: string;
  studentId: string;
  env?: QuizFeatureFlagEnv;
}): Promise<StudentQuizSummary[]> {
  return getStudentQuizSummaries(input);
}

async function getStudentQuizSummaries(input: {
  courseOfferingId: string;
  lessonId?: string;
  studentId: string;
  env?: QuizFeatureFlagEnv;
}): Promise<StudentQuizSummary[]> {
  assertCourseEnabled(input.courseOfferingId, input.env);
  const rows = await db.quiz.findMany({
    where: {
      courseOfferingId: input.courseOfferingId,
      lessonId: input.lessonId,
      status: { in: ["OPEN", "CLOSED"] },
      archivedAt: null,
      cancelledAt: null,
      lesson: { archivedAt: null },
      course: {
        archivedAt: null,
        enrollments: {
          some: { studentId: input.studentId, removedAt: null },
        },
      },
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
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
      lesson: { select: { title: true } },
      scoreItem: { select: { publishedAt: true } },
      questions: {
        where: { voidedAt: null },
        select: { points: true },
      },
      attempts: {
        where: { enrollment: { studentId: input.studentId } },
        orderBy: { attemptNumber: "desc" },
        select: {
          id: true,
          status: true,
          finalScore: true,
        },
      },
    },
  });

  return rows.map((row) => {
    const active = row.attempts.find(
      (attempt) => attempt.status === "IN_PROGRESS"
    );
    const submitted = row.attempts.filter(
      (attempt) => attempt.status !== "IN_PROGRESS"
    );
    return {
      id: row.id,
      courseOfferingId: row.courseOfferingId,
      lessonId: row.lessonId,
      lessonTitle: row.lesson.title,
      title: row.title,
      description: row.description,
      mode: row.mode,
      status: row.status === "OPEN" ? "OPEN" : "CLOSED",
      required: row.required,
      opensAt: row.opensAt,
      closesAt: row.closesAt,
      timeLimitMinutes: row.timeLimitMinutes,
      maxAttempts: row.maxAttempts,
      questionCount: row.questions.length,
      totalPoints: row.questions.reduce(
        (sum, question) => sum + question.points,
        0
      ),
      activeAttemptId: active?.id ?? null,
      submittedAttemptCount: submitted.length,
      latestScore: submitted[0]?.finalScore ?? null,
      scoreVisible:
        row.mode === "PRACTICE" || row.scoreItem?.publishedAt != null,
    };
  });
}

export async function getStudentQuizSummary(input: {
  courseOfferingId: string;
  quizId: string;
  studentId: string;
  env?: QuizFeatureFlagEnv;
}): Promise<StudentQuizSummary> {
  assertCourseEnabled(input.courseOfferingId, input.env);
  const quiz = await db.quiz.findFirst({
    where: {
      id: input.quizId,
      courseOfferingId: input.courseOfferingId,
      status: { in: ["OPEN", "CLOSED"] },
      archivedAt: null,
      cancelledAt: null,
    },
    select: { lessonId: true },
  });
  if (!quiz) throw new NotFound("quiz_not_found");
  const rows = await getStudentQuizSummariesForLesson({
    courseOfferingId: input.courseOfferingId,
    lessonId: quiz.lessonId,
    studentId: input.studentId,
    env: input.env,
  });
  const result = rows.find((row) => row.id === input.quizId);
  if (!result) throw new NotFound("quiz_not_found");
  return result;
}

function assertCourseEnabled(
  courseOfferingId: string,
  env?: QuizFeatureFlagEnv
) {
  if (!quizCourseEnabled(courseOfferingId, env)) {
    throw new Forbidden("quiz_disabled");
  }
}
