import { db } from "@/lib/db/client";
import { Conflict, Forbidden, NotFound } from "@/lib/errors";
import { TX_OPTS } from "@/lib/assignment/constants";
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
};
