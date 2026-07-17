import { Forbidden } from "@/lib/errors";
import {
  quizCourseMutationsEnabled,
  type QuizFeatureFlagEnv,
} from "./feature-flags";
import {
  CreateQuizDraftSchema,
  type CreateQuizDraftData,
  type CreateQuizDraftInput,
} from "./validation";
import { prismaQuizDraftRepository } from "./draft-repository";

export type QuizDraftWrite = {
  actorUserId: string;
  draft: CreateQuizDraftData;
  totalPoints: number;
};

export type QuizDraftReplace = QuizDraftWrite & { quizId: string };

export type QuizDraftResult = { id: string };

export interface QuizDraftRepository {
  createDraft(command: QuizDraftWrite): Promise<QuizDraftResult>;
  replaceDraft(command: QuizDraftReplace): Promise<QuizDraftResult>;
}

export type QuizDraftActorCtx = {
  actorUserId: string;
  env?: QuizFeatureFlagEnv;
  repository?: QuizDraftRepository;
};

export async function createQuizDraft(
  input: CreateQuizDraftInput,
  ctx: QuizDraftActorCtx
): Promise<QuizDraftResult> {
  assertMutationsEnabled(input.courseOfferingId, ctx.env);
  const draft = CreateQuizDraftSchema.parse(input);
  assertAttachmentsDisabled(draft);

  return (ctx.repository ?? prismaQuizDraftRepository).createDraft({
    actorUserId: ctx.actorUserId,
    draft,
    totalPoints: totalPoints(draft),
  });
}

export async function saveQuizDraft(
  quizId: string,
  input: CreateQuizDraftInput,
  ctx: QuizDraftActorCtx
): Promise<QuizDraftResult> {
  assertMutationsEnabled(input.courseOfferingId, ctx.env);
  const draft = CreateQuizDraftSchema.parse(input);
  assertAttachmentsDisabled(draft);

  return (ctx.repository ?? prismaQuizDraftRepository).replaceDraft({
    quizId,
    actorUserId: ctx.actorUserId,
    draft,
    totalPoints: totalPoints(draft),
  });
}

function assertMutationsEnabled(
  courseOfferingId: string,
  env?: QuizFeatureFlagEnv
) {
  if (!quizCourseMutationsEnabled(courseOfferingId, env)) {
    throw new Forbidden("quiz_mutations_disabled");
  }
}

function totalPoints(draft: CreateQuizDraftData): number {
  return draft.questions.reduce((sum, question) => sum + question.points, 0);
}

function assertAttachmentsDisabled(draft: CreateQuizDraftData) {
  const hasAttachments =
    draft.fileAttachmentIds.length > 0 ||
    draft.questions.some(
      (question) =>
        question.fileAttachmentIds.length > 0 ||
        question.options.some((option) => option.fileAttachmentIds.length > 0)
    );
  if (hasAttachments) {
    throw new Forbidden("quiz_attachments_not_enabled");
  }
}
