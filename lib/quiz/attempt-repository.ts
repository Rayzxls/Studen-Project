import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { TX_OPTS } from "@/lib/assignment/constants";
import { Conflict, Forbidden, NotFound, ValidationError } from "@/lib/errors";
import {
  decideAttemptWrite,
  effectiveAttemptDeadline,
  scoreObjectiveAnswer,
} from "./policy";
import {
  toStudentQuizAttemptSnapshot,
  type QuizAttemptSnapshot,
  type QuizSnapshotQuestion,
} from "./attempt-snapshot";
import type {
  GetAttemptCommand,
  QuizAttemptRepository,
  SaveAnswerCommand,
  StartAttemptCommand,
  StudentQuizAttemptView,
  SubmitAttemptCommand,
} from "./attempt-service";

type Tx = Prisma.TransactionClient;

export const prismaQuizAttemptRepository: QuizAttemptRepository = {
  async startOrResume(command) {
    return db.$transaction(async (tx) => {
      const quiz = await loadStartableQuiz(tx, command);
      const enrollment = await activeEnrollment(
        tx,
        command.studentUserId,
        command.courseOfferingId
      );
      const existing = await tx.quizAttempt.findFirst({
        where: {
          quizId: quiz.id,
          enrollmentId: enrollment.id,
          status: "IN_PROGRESS",
        },
        orderBy: { attemptNumber: "desc" },
        select: {
          id: true,
          leaseVersion: true,
          effectiveDeadline: true,
        },
      });
      if (existing) {
        if (
          existing.effectiveDeadline &&
          command.now.getTime() >= existing.effectiveDeadline.getTime()
        ) {
          await finalizeAttempt(tx, existing.id, "DEADLINE", command.now);
        } else {
          const resumed = await tx.quizAttempt.update({
            where: { id: existing.id },
            data: {
              leaseVersion: { increment: 1 },
              leaseTokenHash: command.leaseTokenHash,
              leaseExpiresAt: existing.effectiveDeadline,
            },
            select: { id: true, leaseVersion: true },
          });
          return {
            attemptId: resumed.id,
            leaseVersion: resumed.leaseVersion,
          };
        }
      }

      const [attemptCount, exception] = await Promise.all([
        tx.quizAttempt.count({
          where: { quizId: quiz.id, enrollmentId: enrollment.id },
        }),
        tx.quizStudentException.findUnique({
          where: {
            quizId_enrollmentId: {
              quizId: quiz.id,
              enrollmentId: enrollment.id,
            },
          },
          select: { extendedDeadline: true, extraAttempts: true },
        }),
      ]);
      const defaultLimit =
        quiz.mode === "PRACTICE"
          ? (quiz.maxAttempts ?? Number.MAX_SAFE_INTEGER)
          : (quiz.maxAttempts ?? 1);
      const attemptLimit = defaultLimit + (exception?.extraAttempts ?? 0);
      if (attemptCount >= attemptLimit) {
        throw new Conflict("quiz_attempt_limit_reached");
      }

      const snapshot = buildSnapshot(quiz);
      const timedDeadline = quiz.timeLimitMinutes
        ? new Date(command.now.getTime() + quiz.timeLimitMinutes * 60_000)
        : null;
      const effectiveDeadline = effectiveAttemptDeadline([
        exception?.extendedDeadline ?? quiz.closesAt,
        timedDeadline,
      ]);
      const created = await tx.quizAttempt.create({
        data: {
          quizId: quiz.id,
          enrollmentId: enrollment.id,
          attemptNumber: attemptCount + 1,
          startedAt: command.now,
          effectiveDeadline,
          snapshotRevision: quiz.revision,
          snapshotJson: snapshot as unknown as Prisma.InputJsonValue,
          leaseTokenHash: command.leaseTokenHash,
          leaseExpiresAt: effectiveDeadline,
        },
        select: { id: true, leaseVersion: true },
      });
      return { attemptId: created.id, leaseVersion: created.leaseVersion };
    }, TX_OPTS);
  },

  async saveAnswer(command) {
    return db.$transaction(async (tx) => {
      const attempt = await loadOwnedAttempt(tx, command);
      const duplicate = await mutationResponse(
        tx,
        attempt.id,
        command.answer.idempotencyKey
      );
      if (duplicate && duplicate.kind === "ANSWER_SAVED") {
        return {
          revision: duplicate.revision,
          selectedOptionIds: duplicate.selectedOptionIds,
        };
      }
      assertLease(attempt.leaseTokenHash, command.leaseTokenHash);

      const deadline = attemptDeadline(attempt, command.now);
      const decision = decideAttemptWrite({
        status: attempt.status,
        currentLeaseVersion: attempt.leaseVersion,
        expectedLeaseVersion: command.answer.leaseVersion,
        currentRevision: attempt.writeRevision,
        expectedRevision: command.answer.expectedRevision,
        deadline,
        now: command.now,
      });
      if (!decision.allowed) {
        if (decision.code === "attempt_expired") {
          await finalizeAttempt(tx, attempt.id, "DEADLINE", command.now);
        }
        throw new Conflict(decision.code);
      }

      const snapshot = parseSnapshot(attempt.snapshotJson);
      const question = snapshot.questions.find(
        (item) => item.id === command.answer.questionId
      );
      if (!question)
        throw new ValidationError({ questionId: "ไม่พบคำถามในชุดข้อสอบนี้" });
      validateSelection(question, command.answer.selectedOptionIds);
      const awardedPoints = scoreObjectiveAnswer({
        correctOptionIds: question.options
          .filter((option) => option.isCorrect)
          .map((option) => option.id),
        selectedOptionIds: command.answer.selectedOptionIds,
        points: question.points,
      });
      const revision = attempt.writeRevision + 1;
      const advanced = await tx.quizAttempt.updateMany({
        where: {
          id: attempt.id,
          status: "IN_PROGRESS",
          leaseVersion: attempt.leaseVersion,
          writeRevision: attempt.writeRevision,
          leaseTokenHash: command.leaseTokenHash,
        },
        data: { writeRevision: { increment: 1 } },
      });
      if (advanced.count !== 1) throw new Conflict("stale_revision");

      await tx.quizAnswer.upsert({
        where: {
          attemptId_questionId: {
            attemptId: attempt.id,
            questionId: question.id,
          },
        },
        create: {
          attemptId: attempt.id,
          questionId: question.id,
          answerJson: {
            selectedOptionIds: command.answer.selectedOptionIds,
          },
          isCorrect: awardedPoints === question.points,
          awardedPoints,
          answeredAt: command.now,
        },
        update: {
          answerJson: {
            selectedOptionIds: command.answer.selectedOptionIds,
          },
          isCorrect: awardedPoints === question.points,
          awardedPoints,
          answeredAt: command.now,
        },
      });
      const response = {
        kind: "ANSWER_SAVED" as const,
        revision,
        selectedOptionIds: command.answer.selectedOptionIds,
      };
      await tx.quizAttemptMutation.create({
        data: {
          attemptId: attempt.id,
          idempotencyKey: command.answer.idempotencyKey,
          resultRevision: revision,
          responseJson: response,
        },
      });
      return { revision, selectedOptionIds: response.selectedOptionIds };
    }, TX_OPTS);
  },

  async submit(command) {
    return db.$transaction(async (tx) => {
      const attempt = await loadOwnedAttempt(tx, command);
      const duplicate = await mutationResponse(
        tx,
        attempt.id,
        command.idempotencyKey
      );
      if (duplicate && duplicate.kind === "ATTEMPT_SUBMITTED") {
        return {
          status: duplicate.status,
          score: duplicate.score,
          scoreVisible: duplicate.scoreVisible,
        };
      }
      assertLease(attempt.leaseTokenHash, command.leaseTokenHash);
      const deadline = attemptDeadline(attempt, command.now);
      const decision = decideAttemptWrite({
        status: attempt.status,
        currentLeaseVersion: attempt.leaseVersion,
        expectedLeaseVersion: command.leaseVersion,
        currentRevision: attempt.writeRevision,
        expectedRevision: command.expectedRevision,
        deadline,
        now: command.now,
      });
      if (!decision.allowed && decision.code !== "attempt_expired") {
        throw new Conflict(decision.code);
      }
      const trigger =
        decision.allowed && attempt.quiz.status === "OPEN"
          ? "MANUAL"
          : attempt.quiz.status === "CLOSED"
            ? "QUIZ_CLOSED"
            : "DEADLINE";
      const finalized = await finalizeAttempt(
        tx,
        attempt.id,
        trigger,
        command.now
      );
      const response = {
        kind: "ATTEMPT_SUBMITTED" as const,
        status: finalized.status,
        score: finalized.score,
        scoreVisible: finalized.scoreVisible,
      };
      await tx.quizAttemptMutation.create({
        data: {
          attemptId: attempt.id,
          idempotencyKey: command.idempotencyKey,
          resultRevision: attempt.writeRevision,
          responseJson: response,
        },
      });
      return {
        status: response.status,
        score: response.score,
        scoreVisible: response.scoreVisible,
      };
    }, TX_OPTS);
  },

  async getAttempt(command) {
    return db.$transaction(async (tx) => {
      let attempt = await loadAttemptViewRow(tx, command);
      if (
        command.allowFinalize &&
        attempt.status === "IN_PROGRESS" &&
        (attempt.quiz.status === "CLOSED" ||
          (attempt.effectiveDeadline &&
            command.now.getTime() >= attempt.effectiveDeadline.getTime()))
      ) {
        await finalizeAttempt(
          tx,
          attempt.id,
          attempt.quiz.status === "CLOSED" ? "QUIZ_CLOSED" : "DEADLINE",
          command.now
        );
        attempt = await loadAttemptViewRow(tx, command);
      }
      const snapshot = parseSnapshot(attempt.snapshotJson);
      const answers: Record<string, string[]> = {};
      for (const answer of attempt.answers) {
        answers[answer.questionId] = selectedIds(answer.answerJson);
      }
      const writable =
        attempt.status === "IN_PROGRESS" &&
        attempt.quiz.status === "OPEN" &&
        command.leaseTokenHash !== null &&
        attempt.leaseTokenHash === command.leaseTokenHash &&
        (!attempt.effectiveDeadline ||
          command.now.getTime() < attempt.effectiveDeadline.getTime());
      return {
        id: attempt.id,
        quizId: attempt.quizId,
        courseOfferingId: attempt.quiz.courseOfferingId,
        lessonId: attempt.quiz.lessonId,
        lessonTitle: attempt.quiz.lesson.title,
        attemptNumber: attempt.attemptNumber,
        status: attempt.status,
        startedAt: attempt.startedAt,
        effectiveDeadline: attempt.effectiveDeadline,
        submittedAt: attempt.submittedAt,
        autoScore: attempt.autoScore,
        finalScore: attempt.finalScore,
        leaseVersion: attempt.leaseVersion,
        writeRevision: attempt.writeRevision,
        writable,
        scoreVisible:
          snapshot.mode === "PRACTICE" ||
          attempt.quiz.scoreItem?.publishedAt != null,
        snapshot: toStudentQuizAttemptSnapshot(snapshot),
        answers,
      } satisfies StudentQuizAttemptView;
    }, TX_OPTS);
  },
};

async function loadStartableQuiz(tx: Tx, command: StartAttemptCommand) {
  const quiz = await tx.quiz.findFirst({
    where: {
      id: command.quizId,
      courseOfferingId: command.courseOfferingId,
      archivedAt: null,
      cancelledAt: null,
    },
    select: {
      id: true,
      courseOfferingId: true,
      lessonId: true,
      title: true,
      description: true,
      mode: true,
      status: true,
      revision: true,
      opensAt: true,
      closesAt: true,
      timeLimitMinutes: true,
      maxAttempts: true,
      shuffleQuestions: true,
      shuffleOptions: true,
      hideExplanations: true,
      course: { select: { archivedAt: true } },
      lesson: { select: { archivedAt: true } },
      questions: {
        where: { voidedAt: null },
        orderBy: { position: "asc" },
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
  if (!quiz) throw new NotFound("quiz_not_found");
  if (quiz.course.archivedAt || quiz.lesson.archivedAt) {
    throw new Conflict("quiz_parent_archived");
  }
  if (quiz.status !== "OPEN") throw new Conflict("quiz_not_open");
  if (quiz.opensAt && command.now.getTime() < quiz.opensAt.getTime()) {
    throw new Conflict("quiz_not_started");
  }
  if (quiz.closesAt && command.now.getTime() >= quiz.closesAt.getTime()) {
    throw new Conflict("quiz_closed");
  }
  if (quiz.questions.length === 0) throw new Conflict("quiz_has_no_questions");
  return quiz;
}

async function activeEnrollment(
  tx: Tx,
  studentUserId: string,
  courseOfferingId: string
) {
  const enrollment = await tx.enrollment.findUnique({
    where: {
      studentId_courseOfferingId: {
        studentId: studentUserId,
        courseOfferingId,
      },
    },
    select: { id: true, removedAt: true },
  });
  if (!enrollment || enrollment.removedAt)
    throw new Forbidden("not_course_member");
  return enrollment;
}

function buildSnapshot(
  quiz: Awaited<ReturnType<typeof loadStartableQuiz>>
): QuizAttemptSnapshot {
  let questions = quiz.questions.map((question) => ({
    ...question,
    options: quiz.shuffleOptions
      ? shuffled(question.options)
      : question.options.map((option) => ({ ...option })),
  }));
  if (quiz.shuffleQuestions) questions = shuffled(questions);
  return {
    quizId: quiz.id,
    revision: quiz.revision,
    title: quiz.title,
    description: quiz.description,
    mode: quiz.mode,
    hideExplanations: quiz.hideExplanations,
    totalPoints: questions.reduce((sum, question) => sum + question.points, 0),
    questions,
  };
}

function shuffled<T extends object>(rows: ReadonlyArray<T>): T[] {
  const result = rows.map((row) => ({ ...row }));
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

async function loadOwnedAttempt(
  tx: Tx,
  command: SaveAnswerCommand | SubmitAttemptCommand
) {
  const attempt = await tx.quizAttempt.findFirst({
    where: {
      id: command.attemptId,
      quiz: { courseOfferingId: command.courseOfferingId },
      enrollment: { studentId: command.studentUserId, removedAt: null },
    },
    select: {
      id: true,
      status: true,
      effectiveDeadline: true,
      snapshotJson: true,
      leaseVersion: true,
      leaseTokenHash: true,
      writeRevision: true,
      quiz: {
        select: {
          status: true,
          closesAt: true,
          scoreItem: { select: { publishedAt: true } },
        },
      },
    },
  });
  if (!attempt) throw new NotFound("quiz_attempt_not_found");
  return attempt;
}

function attemptDeadline(
  attempt: Awaited<ReturnType<typeof loadOwnedAttempt>>,
  now: Date
) {
  if (attempt.quiz.status === "CLOSED") return now;
  return effectiveAttemptDeadline([
    attempt.effectiveDeadline,
    attempt.quiz.closesAt,
  ]);
}

function assertLease(current: string | null, supplied: string) {
  if (!current || current !== supplied) throw new Conflict("stale_lease");
}

function validateSelection(
  question: QuizSnapshotQuestion,
  selectedOptionIds: string[]
) {
  const allowed = new Set(question.options.map((option) => option.id));
  if (selectedOptionIds.some((id) => !allowed.has(id))) {
    throw new ValidationError({
      selectedOptionIds: "ตัวเลือกไม่อยู่ในคำถามนี้",
    });
  }
  if (question.type !== "MULTIPLE_SELECT" && selectedOptionIds.length > 1) {
    throw new ValidationError({ selectedOptionIds: "เลือกได้เพียงหนึ่งคำตอบ" });
  }
}

type MutationResponse =
  | { kind: "ANSWER_SAVED"; revision: number; selectedOptionIds: string[] }
  | {
      kind: "ATTEMPT_SUBMITTED";
      status: "SUBMITTED" | "AUTO_SUBMITTED";
      score: number;
      scoreVisible: boolean;
    };

async function mutationResponse(
  tx: Tx,
  attemptId: string,
  idempotencyKey: string
): Promise<MutationResponse | null> {
  const row = await tx.quizAttemptMutation.findUnique({
    where: { attemptId_idempotencyKey: { attemptId, idempotencyKey } },
    select: { responseJson: true },
  });
  return row ? (row.responseJson as unknown as MutationResponse) : null;
}

async function finalizeAttempt(
  tx: Tx,
  attemptId: string,
  trigger: "MANUAL" | "DEADLINE" | "QUIZ_CLOSED",
  now: Date
) {
  const attempt = await tx.quizAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      status: true,
      enrollmentId: true,
      quizId: true,
      quiz: {
        select: {
          mode: true,
          scoreItemId: true,
          scoreItem: { select: { publishedAt: true } },
          course: { select: { teacherId: true } },
        },
      },
      answers: { select: { awardedPoints: true } },
    },
  });
  if (!attempt) throw new NotFound("quiz_attempt_not_found");
  if (attempt.status !== "IN_PROGRESS") {
    const existing = await tx.quizAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: { status: true, finalScore: true },
    });
    return {
      status:
        existing.status === "SUBMITTED"
          ? ("SUBMITTED" as const)
          : ("AUTO_SUBMITTED" as const),
      score: existing.finalScore ?? 0,
      scoreVisible:
        attempt.quiz.mode === "PRACTICE" ||
        attempt.quiz.scoreItem?.publishedAt != null,
    };
  }
  const score = attempt.answers.reduce(
    (sum, answer) => sum + (answer.awardedPoints ?? 0),
    0
  );
  const status: "SUBMITTED" | "AUTO_SUBMITTED" =
    trigger === "MANUAL" ? "SUBMITTED" : "AUTO_SUBMITTED";
  await tx.quizAttempt.update({
    where: { id: attempt.id },
    data: {
      status,
      submittedAt: now,
      submissionTrigger: trigger,
      autoScore: score,
      finalScore: score,
      leaseTokenHash: null,
      leaseExpiresAt: null,
    },
  });

  if (attempt.quiz.mode === "SCORED" && attempt.quiz.scoreItemId) {
    const submitted = await tx.quizAttempt.findMany({
      where: {
        quizId: attempt.quizId,
        enrollmentId: attempt.enrollmentId,
        status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] },
      },
      select: { finalScore: true },
    });
    const best = Math.max(0, ...submitted.map((row) => row.finalScore ?? 0));
    await tx.scoreEntry.upsert({
      where: {
        scoreItemId_enrollmentId: {
          scoreItemId: attempt.quiz.scoreItemId,
          enrollmentId: attempt.enrollmentId,
        },
      },
      create: {
        scoreItemId: attempt.quiz.scoreItemId,
        enrollmentId: attempt.enrollmentId,
        value: best,
        markedById: attempt.quiz.course.teacherId,
      },
      update: {
        value: best,
        markedById: attempt.quiz.course.teacherId,
      },
    });
  }
  return {
    status,
    score,
    scoreVisible:
      attempt.quiz.mode === "PRACTICE" ||
      attempt.quiz.scoreItem?.publishedAt != null,
  };
}

async function loadAttemptViewRow(tx: Tx, command: GetAttemptCommand) {
  const attempt = await tx.quizAttempt.findFirst({
    where: {
      id: command.attemptId,
      quiz: { courseOfferingId: command.courseOfferingId },
      enrollment: { studentId: command.studentUserId },
    },
    select: {
      id: true,
      quizId: true,
      attemptNumber: true,
      status: true,
      startedAt: true,
      effectiveDeadline: true,
      submittedAt: true,
      autoScore: true,
      finalScore: true,
      leaseVersion: true,
      leaseTokenHash: true,
      writeRevision: true,
      snapshotJson: true,
      quiz: {
        select: {
          status: true,
          courseOfferingId: true,
          lessonId: true,
          scoreItem: { select: { publishedAt: true } },
          lesson: { select: { title: true } },
        },
      },
      answers: { select: { questionId: true, answerJson: true } },
    },
  });
  if (!attempt) throw new NotFound("quiz_attempt_not_found");
  return attempt;
}

function parseSnapshot(value: Prisma.JsonValue): QuizAttemptSnapshot {
  return value as unknown as QuizAttemptSnapshot;
}

function selectedIds(value: Prisma.JsonValue): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const ids = (value as { selectedOptionIds?: unknown }).selectedOptionIds;
  return Array.isArray(ids)
    ? ids.filter((item): item is string => typeof item === "string")
    : [];
}
