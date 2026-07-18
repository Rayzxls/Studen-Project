import { Forbidden } from "@/lib/errors";
import {
  quizCourseMutationsEnabled,
  type QuizFeatureFlagEnv,
} from "./feature-flags";
import { prismaQuizLifecycleRepository } from "./lifecycle-repository";
import {
  PublishQuizResultsSchema,
  QuizStudentExceptionSchema,
  ReopenQuizSchema,
  type PublishQuizResultsInput,
  type QuizStudentExceptionInput,
  type ReopenQuizInput,
} from "./validation";

export type OpenQuizCommand = {
  courseOfferingId: string;
  quizId: string;
  actorUserId: string;
  now: Date;
};

export type CloseQuizCommand = OpenQuizCommand;

export type ReopenQuizCommand = OpenQuizCommand & {
  newClosesAt: Date;
  reason: string;
};

export type SetQuizStudentExceptionCommand = OpenQuizCommand & {
  enrollmentId: string;
  extendedDeadline: Date | null;
  extraAttempts: number;
  reason: string;
};

export type PublishQuizResultsCommand = OpenQuizCommand & {
  missingStudentsConfirmed: boolean;
};

export type QuizLifecycleResult = {
  id: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
};

export type PublishQuizResultsResult = QuizLifecycleResult & {
  publishedAt: Date;
  missingStudentCount: number;
};

export interface QuizLifecycleRepository {
  openQuiz(command: OpenQuizCommand): Promise<{ id: string }>;
  closeQuiz(command: CloseQuizCommand): Promise<QuizLifecycleResult>;
  reopenQuiz(command: ReopenQuizCommand): Promise<QuizLifecycleResult>;
  setStudentException(
    command: SetQuizStudentExceptionCommand
  ): Promise<{ id: string }>;
  publishResults(
    command: PublishQuizResultsCommand
  ): Promise<PublishQuizResultsResult>;
}

export type QuizLifecycleActorCtx = {
  actorUserId: string;
  env?: QuizFeatureFlagEnv;
  repository?: QuizLifecycleRepository;
  now?: Date;
};

export async function openQuiz(
  input: { courseOfferingId: string; quizId: string },
  ctx: QuizLifecycleActorCtx
): Promise<{ id: string }> {
  if (!quizCourseMutationsEnabled(input.courseOfferingId, ctx.env)) {
    throw new Forbidden("quiz_mutations_disabled");
  }
  return (ctx.repository ?? prismaQuizLifecycleRepository).openQuiz({
    ...input,
    actorUserId: ctx.actorUserId,
    now: ctx.now ?? new Date(),
  });
}

export async function closeQuiz(
  input: { courseOfferingId: string; quizId: string },
  ctx: QuizLifecycleActorCtx
): Promise<QuizLifecycleResult> {
  assertMutationsEnabled(input.courseOfferingId, ctx.env);
  return (ctx.repository ?? prismaQuizLifecycleRepository).closeQuiz({
    ...input,
    actorUserId: ctx.actorUserId,
    now: ctx.now ?? new Date(),
  });
}

export async function reopenQuiz(
  input: { courseOfferingId: string; quizId: string } & ReopenQuizInput,
  ctx: QuizLifecycleActorCtx
): Promise<QuizLifecycleResult> {
  assertMutationsEnabled(input.courseOfferingId, ctx.env);
  const parsed = ReopenQuizSchema.parse(input);
  return (ctx.repository ?? prismaQuizLifecycleRepository).reopenQuiz({
    courseOfferingId: input.courseOfferingId,
    quizId: input.quizId,
    actorUserId: ctx.actorUserId,
    now: ctx.now ?? new Date(),
    newClosesAt: parsed.newClosesAt,
    reason: parsed.reason,
  });
}

export async function setQuizStudentException(
  input: {
    courseOfferingId: string;
    quizId: string;
  } & QuizStudentExceptionInput,
  ctx: QuizLifecycleActorCtx
): Promise<{ id: string }> {
  assertMutationsEnabled(input.courseOfferingId, ctx.env);
  const parsed = QuizStudentExceptionSchema.parse(input);
  return (ctx.repository ?? prismaQuizLifecycleRepository).setStudentException({
    courseOfferingId: input.courseOfferingId,
    quizId: input.quizId,
    actorUserId: ctx.actorUserId,
    now: ctx.now ?? new Date(),
    ...parsed,
  });
}

export async function publishQuizResults(
  input: {
    courseOfferingId: string;
    quizId: string;
  } & PublishQuizResultsInput,
  ctx: QuizLifecycleActorCtx
): Promise<PublishQuizResultsResult> {
  assertMutationsEnabled(input.courseOfferingId, ctx.env);
  const parsed = PublishQuizResultsSchema.parse(input);
  return (ctx.repository ?? prismaQuizLifecycleRepository).publishResults({
    courseOfferingId: input.courseOfferingId,
    quizId: input.quizId,
    actorUserId: ctx.actorUserId,
    now: ctx.now ?? new Date(),
    missingStudentsConfirmed: parsed.missingStudentsConfirmed,
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
