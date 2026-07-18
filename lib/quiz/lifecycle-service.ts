import { Forbidden } from "@/lib/errors";
import {
  quizCourseMutationsEnabled,
  type QuizFeatureFlagEnv,
} from "./feature-flags";
import { prismaQuizLifecycleRepository } from "./lifecycle-repository";

export type OpenQuizCommand = {
  courseOfferingId: string;
  quizId: string;
  actorUserId: string;
  now: Date;
};

export interface QuizLifecycleRepository {
  openQuiz(command: OpenQuizCommand): Promise<{ id: string }>;
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
