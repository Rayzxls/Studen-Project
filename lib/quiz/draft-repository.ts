import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { Conflict, Forbidden, NotFound } from "@/lib/errors";
import { TX_OPTS } from "@/lib/assignment/constants";
import type {
  QuizDraftReplace,
  QuizDraftRepository,
  QuizDraftWrite,
} from "./draft-service";

export const prismaQuizDraftRepository: QuizDraftRepository = {
  async createDraft(command) {
    return db.$transaction(async (tx) => {
      await assertWritableLesson(tx, command);

      const last = await tx.quiz.findFirst({
        where: { lessonId: command.draft.lessonId, archivedAt: null },
        orderBy: [{ position: "desc" }, { createdAt: "desc" }],
        select: { position: true },
      });
      const scoreItem =
        command.draft.mode === "SCORED"
          ? await tx.scoreItem.create({
              data: {
                courseOfferingId: command.draft.courseOfferingId,
                name: command.draft.title,
                fullScore: command.totalPoints,
                source: "QUIZ_LINKED",
              },
            })
          : null;

      const quiz = await tx.quiz.create({
        data: {
          ...quizFields(command),
          position: (last?.position ?? -1) + 1,
          createdById: command.actorUserId,
          scoreItemId: scoreItem?.id ?? null,
          questions: { create: questionRows(command) },
        },
        select: { id: true },
      });
      return quiz;
    }, TX_OPTS);
  },

  async replaceDraft(command) {
    return db.$transaction(async (tx) => {
      const current = await tx.quiz.findUnique({
        where: { id: command.quizId },
        select: {
          id: true,
          courseOfferingId: true,
          status: true,
          cancelledAt: true,
          archivedAt: true,
          mode: true,
          scoreItemId: true,
          course: { select: { teacherId: true, archivedAt: true } },
          scoreItem: {
            select: {
              id: true,
              publishedAt: true,
              _count: { select: { entries: true } },
            },
          },
          _count: { select: { attempts: true } },
        },
      });
      if (!current) throw new NotFound("quiz_not_found");
      if (current.courseOfferingId !== command.draft.courseOfferingId) {
        throw new Conflict("quiz_course_mismatch");
      }
      assertTeacherOwnsCourse(current.course, command.actorUserId);
      if (
        current.status !== "DRAFT" ||
        current.cancelledAt !== null ||
        current.archivedAt !== null
      ) {
        throw new Conflict("quiz_not_editable");
      }
      if (current._count.attempts > 0) {
        throw new Conflict("quiz_content_locked_after_attempt");
      }
      await assertWritableLesson(tx, command);

      let scoreItemId = current.scoreItemId;
      if (command.draft.mode === "SCORED") {
        if (current.scoreItem) {
          assertScoreItemEditable(current.scoreItem);
          await tx.scoreItem.update({
            where: { id: current.scoreItem.id },
            data: {
              name: command.draft.title,
              fullScore: command.totalPoints,
            },
          });
        } else {
          const created = await tx.scoreItem.create({
            data: {
              courseOfferingId: command.draft.courseOfferingId,
              name: command.draft.title,
              fullScore: command.totalPoints,
              source: "QUIZ_LINKED",
            },
          });
          scoreItemId = created.id;
        }
      } else if (current.scoreItem) {
        assertScoreItemEditable(current.scoreItem);
        await tx.quiz.update({
          where: { id: command.quizId },
          data: { scoreItemId: null },
        });
        await tx.scoreItem.delete({ where: { id: current.scoreItem.id } });
        scoreItemId = null;
      }

      await tx.quizQuestion.deleteMany({ where: { quizId: command.quizId } });
      return tx.quiz.update({
        where: { id: command.quizId },
        data: {
          ...quizFields(command),
          scoreItemId,
          revision: { increment: 1 },
          questions: { create: questionRows(command) },
        },
        select: { id: true },
      });
    }, TX_OPTS);
  },
};

type Transaction = Prisma.TransactionClient;

async function assertWritableLesson(
  tx: Transaction,
  command: QuizDraftWrite | QuizDraftReplace
) {
  const course = await tx.courseOffering.findUnique({
    where: { id: command.draft.courseOfferingId },
    select: { teacherId: true, archivedAt: true },
  });
  if (!course) throw new NotFound("course_not_found");
  assertTeacherOwnsCourse(course, command.actorUserId);

  const lesson = await tx.lesson.findFirst({
    where: {
      id: command.draft.lessonId,
      courseOfferingId: command.draft.courseOfferingId,
    },
    select: { archivedAt: true },
  });
  if (!lesson) throw new NotFound("lesson_not_found");
  if (lesson.archivedAt !== null) throw new Conflict("lesson_archived");
}

function assertTeacherOwnsCourse(
  course: { teacherId: string; archivedAt: Date | null },
  actorUserId: string
) {
  if (course.archivedAt !== null) throw new Conflict("course_archived");
  if (course.teacherId !== actorUserId) {
    throw new Forbidden("not_course_owner");
  }
}

function assertScoreItemEditable(scoreItem: {
  publishedAt: Date | null;
  _count: { entries: number };
}) {
  if (scoreItem.publishedAt !== null) {
    throw new Conflict("quiz_scoreitem_published");
  }
  if (scoreItem._count.entries > 0) {
    throw new Conflict("quiz_scoreitem_has_entries");
  }
}

function quizFields(command: QuizDraftWrite | QuizDraftReplace) {
  const { draft } = command;
  return {
    courseOfferingId: draft.courseOfferingId,
    lessonId: draft.lessonId,
    title: draft.title,
    description: draft.description,
    mode: draft.mode,
    required: draft.required,
    opensAt: draft.opensAt,
    closesAt: draft.closesAt,
    timeLimitMinutes: draft.timeLimitMinutes,
    maxAttempts: draft.maxAttempts,
    passThresholdPercent: draft.passThresholdPercent,
    shuffleQuestions: draft.shuffleQuestions,
    shuffleOptions: draft.shuffleOptions,
    hideExplanations: draft.hideExplanations,
    fileAttachmentIds: draft.fileAttachmentIds as Prisma.InputJsonValue,
  };
}

function questionRows(command: QuizDraftWrite | QuizDraftReplace) {
  return command.draft.questions.map((question, position) => ({
    type: question.type,
    prompt: question.prompt,
    explanation: question.explanation,
    points: question.points,
    position,
    fileAttachmentIds: question.fileAttachmentIds as Prisma.InputJsonValue,
    options: {
      create: question.options.map((option, optionPosition) => ({
        text: option.text,
        isCorrect: option.isCorrect,
        position: optionPosition,
        fileAttachmentIds: option.fileAttachmentIds as Prisma.InputJsonValue,
      })),
    },
  }));
}
