import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit/log";
import { Conflict, Forbidden, NotFound } from "@/lib/errors";
import { TX_OPTS } from "@/lib/assignment/constants";
import { fanOutBroadcast, fanOutTargeted } from "@/lib/notification";
import { finalizeQuizAttemptsAtClose } from "./attempt-repository";
import { canPublishScoredQuiz, canReopenQuiz } from "./policy";
import type {
  OpenQuizCommand,
  QuizLifecycleRepository,
} from "./lifecycle-service";

export const prismaQuizLifecycleRepository: QuizLifecycleRepository = {
  async openQuiz(command: OpenQuizCommand) {
    return db.$transaction(async (tx) => {
      const quiz = await tx.quiz.findFirst({
        where: {
          id: command.quizId,
          courseOfferingId: command.courseOfferingId,
        },
        select: {
          id: true,
          status: true,
          cancelledAt: true,
          archivedAt: true,
          opensAt: true,
          closesAt: true,
          mode: true,
          scoreItemId: true,
          course: { select: { teacherId: true, archivedAt: true } },
          lesson: { select: { archivedAt: true } },
          scoreItem: {
            select: { source: true, fullScore: true, publishedAt: true },
          },
          questions: {
            where: { voidedAt: null },
            select: { points: true },
          },
          _count: { select: { attempts: true } },
        },
      });
      if (!quiz) throw new NotFound("quiz_not_found");
      if (quiz.course.teacherId !== command.actorUserId) {
        throw new Forbidden("not_course_owner");
      }
      if (quiz.course.archivedAt || quiz.lesson.archivedAt) {
        throw new Conflict("quiz_parent_archived");
      }
      if (
        quiz.status !== "DRAFT" ||
        quiz.cancelledAt ||
        quiz.archivedAt ||
        quiz._count.attempts > 0
      ) {
        throw new Conflict("quiz_not_openable");
      }
      if (quiz.questions.length === 0) {
        throw new Conflict("quiz_has_no_questions");
      }
      if (quiz.closesAt && quiz.closesAt.getTime() <= command.now.getTime()) {
        throw new Conflict("quiz_close_time_passed");
      }

      const totalPoints = quiz.questions.reduce(
        (sum, question) => sum + question.points,
        0
      );
      if (quiz.mode === "SCORED") {
        if (
          !quiz.scoreItem ||
          !quiz.scoreItemId ||
          quiz.scoreItem.source !== "QUIZ_LINKED"
        ) {
          throw new Conflict("quiz_scoreitem_missing");
        }
        if (quiz.scoreItem.publishedAt) {
          throw new Conflict("quiz_scoreitem_published");
        }
        if (quiz.scoreItem.fullScore !== totalPoints) {
          throw new Conflict("quiz_score_mismatch");
        }
      }

      return tx.quiz.update({
        where: { id: quiz.id },
        data: { status: "OPEN" },
        select: { id: true },
      });
    }, TX_OPTS);
  },

  async closeQuiz(command) {
    return db.$transaction(async (tx) => {
      const quiz = await tx.quiz.findFirst({
        where: {
          id: command.quizId,
          courseOfferingId: command.courseOfferingId,
        },
        select: {
          id: true,
          status: true,
          cancelledAt: true,
          archivedAt: true,
          course: { select: { teacherId: true, archivedAt: true } },
          lesson: { select: { archivedAt: true } },
        },
      });
      if (!quiz) throw new NotFound("quiz_not_found");
      assertOwnerAndActiveParents(quiz, command.actorUserId);
      if (quiz.status !== "OPEN" || quiz.cancelledAt || quiz.archivedAt) {
        throw new Conflict("quiz_not_closeable");
      }

      const updated = await tx.quiz.update({
        where: { id: quiz.id },
        data: { status: "CLOSED" },
        select: { id: true, status: true },
      });
      await finalizeQuizAttemptsAtClose(tx, quiz.id, command.now);
      return updated;
    }, TX_OPTS);
  },

  async reopenQuiz(command) {
    return db.$transaction(async (tx) => {
      const quiz = await tx.quiz.findFirst({
        where: {
          id: command.quizId,
          courseOfferingId: command.courseOfferingId,
        },
        select: {
          id: true,
          title: true,
          status: true,
          cancelledAt: true,
          archivedAt: true,
          closesAt: true,
          scoreItem: { select: { publishedAt: true } },
          course: {
            select: { teacherId: true, archivedAt: true, name: true },
          },
          lesson: { select: { archivedAt: true } },
        },
      });
      if (!quiz) throw new NotFound("quiz_not_found");
      assertOwnerAndActiveParents(quiz, command.actorUserId);
      if (quiz.cancelledAt || quiz.archivedAt) {
        throw new Conflict("quiz_not_reopenable");
      }
      if (
        !canReopenQuiz({
          status: quiz.status,
          publishedAt: quiz.scoreItem?.publishedAt ?? null,
          newClosesAt: command.newClosesAt,
          now: command.now,
        })
      ) {
        throw new Conflict("quiz_not_reopenable");
      }

      const updated = await tx.quiz.update({
        where: { id: quiz.id },
        data: { status: "OPEN", closesAt: command.newClosesAt },
        select: { id: true, status: true },
      });
      await audit(
        {
          actorId: command.actorUserId,
          actorRole: "TEACHER",
          action: "QUIZ_REOPENED",
          targetType: "Quiz",
          targetId: quiz.id,
          targetLabel: quiz.title,
          reason: command.reason,
          before: {
            status: quiz.status,
            closesAt: quiz.closesAt?.toISOString() ?? null,
          },
          after: {
            status: updated.status,
            closesAt: command.newClosesAt.toISOString(),
          },
        },
        tx
      );
      await fanOutBroadcast(tx, {
        kind: "QUIZ_REOPENED",
        sourceEntityType: "QUIZ",
        sourceEntityId: quiz.id,
        courseOfferingId: command.courseOfferingId,
        payload: {
          courseId: command.courseOfferingId,
          courseName: quiz.course.name,
          quizId: quiz.id,
          quizTitle: quiz.title,
          newClosesAt: command.newClosesAt.toISOString(),
        },
      });
      return updated;
    }, TX_OPTS);
  },

  async setStudentException(command) {
    return db.$transaction(async (tx) => {
      const quiz = await tx.quiz.findFirst({
        where: {
          id: command.quizId,
          courseOfferingId: command.courseOfferingId,
        },
        select: {
          id: true,
          title: true,
          mode: true,
          status: true,
          closesAt: true,
          timeLimitMinutes: true,
          maxAttempts: true,
          cancelledAt: true,
          archivedAt: true,
          scoreItem: { select: { publishedAt: true } },
          course: {
            select: { teacherId: true, archivedAt: true, name: true },
          },
          lesson: { select: { archivedAt: true } },
        },
      });
      if (!quiz) throw new NotFound("quiz_not_found");
      assertOwnerAndActiveParents(quiz, command.actorUserId);
      if (
        quiz.status === "DRAFT" ||
        quiz.cancelledAt ||
        quiz.archivedAt ||
        quiz.scoreItem?.publishedAt
      ) {
        throw new Conflict("quiz_exception_not_allowed");
      }
      if (
        command.extendedDeadline &&
        (command.extendedDeadline.getTime() <= command.now.getTime() ||
          (quiz.closesAt &&
            command.extendedDeadline.getTime() <= quiz.closesAt.getTime()))
      ) {
        throw new Conflict("quiz_exception_deadline_not_extended");
      }
      if (quiz.mode === "PRACTICE" && command.extraAttempts > 0) {
        throw new Conflict("practice_quiz_attempts_unlimited");
      }
      if (
        quiz.mode === "SCORED" &&
        (quiz.maxAttempts ?? 1) + command.extraAttempts > 10
      ) {
        throw new Conflict("quiz_attempt_limit_exceeded");
      }

      const enrollment = await tx.enrollment.findFirst({
        where: {
          id: command.enrollmentId,
          courseOfferingId: command.courseOfferingId,
          removedAt: null,
        },
        select: { id: true, studentId: true },
      });
      if (!enrollment) throw new NotFound("enrollment_not_found");
      const existing = await tx.quizStudentException.findUnique({
        where: {
          quizId_enrollmentId: {
            quizId: quiz.id,
            enrollmentId: enrollment.id,
          },
        },
        select: { extendedDeadline: true, extraAttempts: true, reason: true },
      });
      const saved = await tx.quizStudentException.upsert({
        where: {
          quizId_enrollmentId: {
            quizId: quiz.id,
            enrollmentId: enrollment.id,
          },
        },
        create: {
          quizId: quiz.id,
          enrollmentId: enrollment.id,
          extendedDeadline: command.extendedDeadline,
          extraAttempts: command.extraAttempts,
          reason: command.reason,
          createdById: command.actorUserId,
        },
        update: {
          extendedDeadline: command.extendedDeadline,
          extraAttempts: command.extraAttempts,
          reason: command.reason,
          createdById: command.actorUserId,
        },
        select: { id: true },
      });

      if (command.extendedDeadline) {
        const activeAttempts = await tx.quizAttempt.findMany({
          where: {
            quizId: quiz.id,
            enrollmentId: enrollment.id,
            status: "IN_PROGRESS",
          },
          select: { id: true, startedAt: true },
        });
        for (const attempt of activeAttempts) {
          const timedDeadline = quiz.timeLimitMinutes
            ? new Date(
                attempt.startedAt.getTime() + quiz.timeLimitMinutes * 60_000
              )
            : null;
          const effectiveDeadline =
            timedDeadline &&
            timedDeadline.getTime() < command.extendedDeadline.getTime()
              ? timedDeadline
              : command.extendedDeadline;
          await tx.quizAttempt.update({
            where: { id: attempt.id },
            data: { effectiveDeadline, leaseExpiresAt: effectiveDeadline },
          });
        }
      }

      await audit(
        {
          actorId: command.actorUserId,
          actorRole: "TEACHER",
          action: "QUIZ_STUDENT_EXCEPTION_GRANTED",
          targetType: "QuizStudentException",
          targetId: saved.id,
          targetLabel: quiz.title,
          reason: command.reason,
          before: existing
            ? {
                extendedDeadline:
                  existing.extendedDeadline?.toISOString() ?? null,
                extraAttempts: existing.extraAttempts,
              }
            : undefined,
          after: {
            enrollmentId: enrollment.id,
            extendedDeadline: command.extendedDeadline?.toISOString() ?? null,
            extraAttempts: command.extraAttempts,
          },
        },
        tx
      );
      await fanOutTargeted(tx, {
        kind: "QUIZ_EXCEPTION_GRANTED",
        sourceEntityType: "QUIZ",
        sourceEntityId: quiz.id,
        courseOfferingId: command.courseOfferingId,
        recipientId: enrollment.studentId,
        payload: {
          courseId: command.courseOfferingId,
          courseName: quiz.course.name,
          quizId: quiz.id,
          quizTitle: quiz.title,
          extendedDeadline: command.extendedDeadline?.toISOString() ?? null,
          extraAttempts: command.extraAttempts,
        },
      });
      return saved;
    }, TX_OPTS);
  },

  async publishResults(command) {
    return db.$transaction(async (tx) => {
      const quiz = await tx.quiz.findFirst({
        where: {
          id: command.quizId,
          courseOfferingId: command.courseOfferingId,
        },
        select: {
          id: true,
          title: true,
          mode: true,
          status: true,
          cancelledAt: true,
          archivedAt: true,
          scoreItemId: true,
          scoreItem: {
            select: {
              id: true,
              name: true,
              source: true,
              fullScore: true,
              publishedAt: true,
            },
          },
          course: {
            select: { teacherId: true, archivedAt: true, name: true },
          },
          lesson: { select: { archivedAt: true } },
        },
      });
      if (!quiz) throw new NotFound("quiz_not_found");
      assertOwnerAndActiveParents(quiz, command.actorUserId);
      if (
        quiz.mode !== "SCORED" ||
        quiz.archivedAt ||
        !quiz.scoreItemId ||
        !quiz.scoreItem ||
        quiz.scoreItem.source !== "QUIZ_LINKED"
      ) {
        throw new Conflict("quiz_results_not_publishable");
      }
      if (quiz.scoreItem.publishedAt) throw new Conflict("already_published");

      await finalizeQuizAttemptsAtClose(tx, quiz.id, command.now);
      const activeEnrollments = await tx.enrollment.findMany({
        where: {
          courseOfferingId: command.courseOfferingId,
          removedAt: null,
        },
        select: { id: true },
      });
      const submitted = await tx.quizAttempt.findMany({
        where: {
          quizId: quiz.id,
          enrollmentId: { in: activeEnrollments.map((row) => row.id) },
          status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] },
        },
        select: { enrollmentId: true },
        distinct: ["enrollmentId"],
      });
      const submittedIds = new Set(submitted.map((row) => row.enrollmentId));
      const missingStudentCount = activeEnrollments.filter(
        (row) => !submittedIds.has(row.id)
      ).length;
      if (
        !canPublishScoredQuiz({
          status: quiz.status,
          cancelledAt: quiz.cancelledAt,
          missingStudentCount,
          missingStudentsConfirmed: command.missingStudentsConfirmed,
        })
      ) {
        throw new Conflict(
          missingStudentCount > 0 && !command.missingStudentsConfirmed
            ? "quiz_missing_students_not_confirmed"
            : "quiz_results_not_publishable"
        );
      }

      if (missingStudentCount > 0) {
        await tx.scoreEntry.createMany({
          data: activeEnrollments
            .filter((row) => !submittedIds.has(row.id))
            .map((row) => ({
              scoreItemId: quiz.scoreItem!.id,
              enrollmentId: row.id,
              value: 0,
              markedById: command.actorUserId,
            })),
          skipDuplicates: true,
        });
      }

      const scoreItem = await tx.scoreItem.update({
        where: { id: quiz.scoreItem.id },
        data: { publishedAt: command.now },
        select: { id: true, publishedAt: true },
      });
      await audit(
        {
          actorId: command.actorUserId,
          actorRole: "TEACHER",
          action: "SCORE_ITEM_PUBLISHED",
          targetType: "ScoreItem",
          targetId: quiz.scoreItem.id,
          targetLabel: quiz.scoreItem.name,
          after: {
            name: quiz.scoreItem.name,
            fullScore: quiz.scoreItem.fullScore,
            publishedAt: command.now.toISOString(),
            quizId: quiz.id,
            missingStudentCount,
          },
        },
        tx
      );
      await fanOutBroadcast(tx, {
        kind: "SCORE_ITEM_PUBLISHED",
        sourceEntityType: "SCORE_ITEM",
        sourceEntityId: quiz.scoreItem.id,
        courseOfferingId: command.courseOfferingId,
        payload: {
          courseId: command.courseOfferingId,
          courseName: quiz.course.name,
          itemName: quiz.scoreItem.name,
          publishedAt: command.now.toISOString(),
        },
      });
      return {
        id: quiz.id,
        status: quiz.status,
        publishedAt: scoreItem.publishedAt ?? command.now,
        missingStudentCount,
      };
    }, TX_OPTS);
  },
};

function assertOwnerAndActiveParents(
  quiz: {
    course: { teacherId: string; archivedAt: Date | null };
    lesson: { archivedAt: Date | null };
  },
  actorUserId: string
) {
  if (quiz.course.teacherId !== actorUserId) {
    throw new Forbidden("not_course_owner");
  }
  if (quiz.course.archivedAt || quiz.lesson.archivedAt) {
    throw new Conflict("quiz_parent_archived");
  }
}
