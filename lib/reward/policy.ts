import type { RewardAchievementType } from "@prisma/client";

export const REWARD_REASON_MIN_LENGTH = 5;
export const REWARD_REASON_MAX_LENGTH = 500;

export function normalizeRewardPoints(points: number): number {
  if (!Number.isSafeInteger(points) || points <= 0) {
    throw new Error("reward_points_must_be_positive_integer");
  }
  return points;
}

export function normalizeRewardAchievementId(achievementId: string): string {
  const normalized = achievementId.trim();
  if (!normalized) throw new Error("reward_achievement_required");
  if (normalized.length > 200) {
    throw new Error("reward_achievement_too_long");
  }
  return normalized;
}

export function normalizeRewardReason(
  reason: string | undefined,
  options: { required: boolean }
): string | null {
  const normalized = reason?.trim() ?? "";
  if (!normalized) {
    if (options.required) throw new Error("reward_reason_required");
    return null;
  }
  if (normalized.length < REWARD_REASON_MIN_LENGTH) {
    throw new Error("reward_reason_too_short");
  }
  if (normalized.length > REWARD_REASON_MAX_LENGTH) {
    throw new Error("reward_reason_too_long");
  }
  return normalized;
}

/** Stable idempotency key: one award per Enrollment achievement. */
export function courseRewardAwardKey(input: {
  enrollmentId: string;
  achievementType: RewardAchievementType;
  achievementId: string;
}): string {
  return JSON.stringify([
    "COURSE",
    input.enrollmentId,
    input.achievementType,
    normalizeRewardAchievementId(input.achievementId),
  ]);
}

export function courseRewardFrozen(input: {
  courseArchivedAt: Date | null;
  enrollmentRemovedAt: Date | null;
}): boolean {
  return input.courseArchivedAt !== null || input.enrollmentRemovedAt !== null;
}
