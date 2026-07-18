import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { Forbidden, ValidationError } from "@/lib/errors";
import {
  quizCourseEnabled,
  quizCourseMutationsEnabled,
  type QuizFeatureFlagEnv,
} from "./feature-flags";
import { prismaQuizAttemptRepository } from "./attempt-repository";
import {
  QuizAttemptAnswerSchema,
  type QuizAttemptAnswerInput,
} from "./validation";
import type { StudentQuizAttemptSnapshot } from "./attempt-snapshot";

export type {
  QuizAttemptSnapshot,
  QuizSnapshotOption,
  QuizSnapshotQuestion,
  StudentQuizAttemptSnapshot,
} from "./attempt-snapshot";

export type StudentQuizAttemptView = {
  id: string;
  quizId: string;
  courseOfferingId: string;
  lessonId: string;
  lessonTitle: string;
  attemptNumber: number;
  status: "IN_PROGRESS" | "SUBMITTED" | "AUTO_SUBMITTED";
  startedAt: Date;
  effectiveDeadline: Date | null;
  submittedAt: Date | null;
  autoScore: number | null;
  finalScore: number | null;
  leaseVersion: number;
  writeRevision: number;
  writable: boolean;
  scoreVisible: boolean;
  snapshot: StudentQuizAttemptSnapshot;
  answers: Record<string, string[]>;
};

export type StartAttemptCommand = {
  courseOfferingId: string;
  quizId: string;
  studentUserId: string;
  leaseTokenHash: string;
  now: Date;
};

export type SaveAnswerCommand = {
  courseOfferingId: string;
  attemptId: string;
  studentUserId: string;
  leaseTokenHash: string;
  answer: ReturnType<typeof QuizAttemptAnswerSchema.parse>;
  now: Date;
};

export type SubmitAttemptCommand = {
  courseOfferingId: string;
  attemptId: string;
  studentUserId: string;
  leaseTokenHash: string;
  expectedRevision: number;
  leaseVersion: number;
  idempotencyKey: string;
  now: Date;
};

export type GetAttemptCommand = {
  courseOfferingId: string;
  attemptId: string;
  studentUserId: string;
  leaseTokenHash: string | null;
  allowFinalize: boolean;
  now: Date;
};

export interface QuizAttemptRepository {
  startOrResume(command: StartAttemptCommand): Promise<{
    attemptId: string;
    leaseVersion: number;
  }>;
  saveAnswer(command: SaveAnswerCommand): Promise<{
    revision: number;
    selectedOptionIds: string[];
  }>;
  submit(command: SubmitAttemptCommand): Promise<{
    status: "SUBMITTED" | "AUTO_SUBMITTED";
    score: number;
    scoreVisible: boolean;
  }>;
  getAttempt(command: GetAttemptCommand): Promise<StudentQuizAttemptView>;
}

export type QuizAttemptActorCtx = {
  studentUserId: string;
  env?: QuizFeatureFlagEnv;
  repository?: QuizAttemptRepository;
  now?: Date;
  leaseTokenFactory?: () => string;
};

export async function startOrResumeQuizAttempt(
  input: { courseOfferingId: string; quizId: string },
  ctx: QuizAttemptActorCtx
) {
  assertMutationsEnabled(input.courseOfferingId, ctx.env);
  const leaseToken = (ctx.leaseTokenFactory ?? defaultLeaseToken)();
  const result = await (
    ctx.repository ?? prismaQuizAttemptRepository
  ).startOrResume({
    ...input,
    studentUserId: ctx.studentUserId,
    leaseTokenHash: hashLeaseToken(leaseToken),
    now: ctx.now ?? new Date(),
  });
  return { ...result, leaseToken };
}

export async function saveQuizAttemptAnswer(
  input: QuizAttemptAnswerInput & {
    courseOfferingId: string;
    attemptId: string;
    leaseToken: string;
  },
  ctx: QuizAttemptActorCtx
) {
  assertMutationsEnabled(input.courseOfferingId, ctx.env);
  const answer = QuizAttemptAnswerSchema.parse(input);
  return (ctx.repository ?? prismaQuizAttemptRepository).saveAnswer({
    courseOfferingId: input.courseOfferingId,
    attemptId: input.attemptId,
    studentUserId: ctx.studentUserId,
    leaseTokenHash: hashLeaseToken(requireLeaseToken(input.leaseToken)),
    answer,
    now: ctx.now ?? new Date(),
  });
}

const SubmitAttemptSchema = z.object({
  expectedRevision: z.int().min(0),
  leaseVersion: z.int().min(1),
  idempotencyKey: z.string().trim().min(1).max(128),
});

export async function submitQuizAttempt(
  input: z.input<typeof SubmitAttemptSchema> & {
    courseOfferingId: string;
    attemptId: string;
    leaseToken: string;
  },
  ctx: QuizAttemptActorCtx
) {
  assertMutationsEnabled(input.courseOfferingId, ctx.env);
  const parsed = SubmitAttemptSchema.parse(input);
  return (ctx.repository ?? prismaQuizAttemptRepository).submit({
    courseOfferingId: input.courseOfferingId,
    attemptId: input.attemptId,
    studentUserId: ctx.studentUserId,
    leaseTokenHash: hashLeaseToken(requireLeaseToken(input.leaseToken)),
    ...parsed,
    now: ctx.now ?? new Date(),
  });
}

export async function getStudentQuizAttempt(
  input: {
    courseOfferingId: string;
    attemptId: string;
    leaseToken?: string | null;
  },
  ctx: QuizAttemptActorCtx
) {
  if (!quizCourseEnabled(input.courseOfferingId, ctx.env)) {
    throw new Forbidden("quiz_disabled");
  }
  return (ctx.repository ?? prismaQuizAttemptRepository).getAttempt({
    courseOfferingId: input.courseOfferingId,
    attemptId: input.attemptId,
    studentUserId: ctx.studentUserId,
    leaseTokenHash: input.leaseToken ? hashLeaseToken(input.leaseToken) : null,
    allowFinalize: quizCourseMutationsEnabled(input.courseOfferingId, ctx.env),
    now: ctx.now ?? new Date(),
  });
}

export function hashLeaseToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function defaultLeaseToken(): string {
  return randomBytes(32).toString("base64url");
}

function requireLeaseToken(value: string): string {
  const token = value.trim();
  if (!token)
    throw new ValidationError({ leaseToken: "ไม่พบสิทธิ์แก้ไขชุดคำตอบ" });
  return token;
}

function assertMutationsEnabled(
  courseOfferingId: string,
  env?: QuizFeatureFlagEnv
) {
  if (!quizCourseMutationsEnabled(courseOfferingId, env)) {
    throw new Forbidden("quiz_mutations_disabled");
  }
}
