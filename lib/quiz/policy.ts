export type QuizLifecycleState = "DRAFT" | "OPEN" | "CLOSED";
export type QuizAttemptState = "IN_PROGRESS" | "SUBMITTED" | "AUTO_SUBMITTED";

export type AttemptWriteDecision =
  | { allowed: true }
  | {
      allowed: false;
      code:
        | "attempt_not_active"
        | "stale_lease"
        | "stale_revision"
        | "attempt_expired";
    };

export function canEditQuizContent(input: { attemptCount: number }): boolean {
  return input.attemptCount === 0;
}

export function canDeleteQuiz(input: { attemptCount: number }): boolean {
  return input.attemptCount === 0;
}

export function canCancelQuiz(input: { publishedAt: Date | null }): boolean {
  return input.publishedAt === null;
}

export function canReopenQuiz(input: {
  status: QuizLifecycleState;
  publishedAt: Date | null;
  newClosesAt: Date;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  return (
    input.status === "CLOSED" &&
    input.publishedAt === null &&
    input.newClosesAt.getTime() > now.getTime()
  );
}

export function canPublishScoredQuiz(input: {
  status: QuizLifecycleState;
  cancelledAt: Date | null;
  missingStudentCount: number;
  missingStudentsConfirmed: boolean;
}): boolean {
  if (input.status !== "CLOSED" || input.cancelledAt !== null) return false;
  return input.missingStudentCount === 0 || input.missingStudentsConfirmed;
}

export function effectiveAttemptDeadline(
  deadlines: ReadonlyArray<Date | null | undefined>
): Date | null {
  let earliest: Date | null = null;
  for (const deadline of deadlines) {
    if (deadline === null || deadline === undefined) continue;
    if (earliest === null || deadline.getTime() < earliest.getTime()) {
      earliest = deadline;
    }
  }
  return earliest;
}

export function decideAttemptWrite(input: {
  status: QuizAttemptState;
  currentLeaseVersion: number;
  expectedLeaseVersion: number;
  currentRevision: number;
  expectedRevision: number;
  deadline: Date | null;
  now?: Date;
}): AttemptWriteDecision {
  if (input.status !== "IN_PROGRESS") {
    return { allowed: false, code: "attempt_not_active" };
  }
  if (input.currentLeaseVersion !== input.expectedLeaseVersion) {
    return { allowed: false, code: "stale_lease" };
  }
  if (input.currentRevision !== input.expectedRevision) {
    return { allowed: false, code: "stale_revision" };
  }

  const now = input.now ?? new Date();
  if (input.deadline !== null && now.getTime() >= input.deadline.getTime()) {
    return { allowed: false, code: "attempt_expired" };
  }
  return { allowed: true };
}

export function scoreObjectiveAnswer(input: {
  correctOptionIds: ReadonlyArray<string>;
  selectedOptionIds: ReadonlyArray<string>;
  points: number;
}): number {
  const correct = new Set(input.correctOptionIds);
  const selected = new Set(input.selectedOptionIds);
  if (correct.size !== selected.size) return 0;
  for (const optionId of correct) {
    if (!selected.has(optionId)) return 0;
  }
  return input.points;
}

export function selectBestAttempt<
  T extends {
    status: QuizAttemptState;
    score: number;
    submittedAtMs: number | null;
  },
>(attempts: ReadonlyArray<T>): T | null {
  const submitted = attempts.filter(
    (attempt) =>
      attempt.status === "SUBMITTED" || attempt.status === "AUTO_SUBMITTED"
  );
  if (submitted.length === 0) return null;

  return submitted.reduce((best, candidate) => {
    if (candidate.score > best.score) return candidate;
    if (candidate.score < best.score) return best;

    const candidateTime = candidate.submittedAtMs ?? Number.MAX_SAFE_INTEGER;
    const bestTime = best.submittedAtMs ?? Number.MAX_SAFE_INTEGER;
    return candidateTime < bestTime ? candidate : best;
  });
}
