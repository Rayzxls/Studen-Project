import { scoreTotal } from "@/lib/scoring/calc";

export const COURSE_REWARD_TITLE_MAX = 120;
export const COURSE_REWARD_DESCRIPTION_MAX = 1_000;
export const COURSE_REWARD_INSTRUCTIONS_MAX = 1_000;
export const COURSE_REWARD_RESOLUTION_REASON_MIN = 5;
export const COURSE_REWARD_RESOLUTION_REASON_MAX = 500;

type ScoreItemInput = Readonly<{
  id: string;
  fullScore: number;
  publishedAt: Date | null;
}>;

type ScoreEntryInput = Readonly<{
  scoreItemId: string;
  value: number;
}>;

export type CourseRewardScoreSnapshot = Readonly<{
  percent: number;
  earnedScore: number;
  publishedFullScore: number;
}>;

function normalizeRequiredText(
  value: string,
  field: string,
  max: number
): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field}_required`);
  if (normalized.length > max) throw new Error(`${field}_too_long`);
  return normalized;
}

function normalizeOptionalText(
  value: string | null | undefined,
  field: string,
  max: number
): string | null {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  if (normalized.length > max) throw new Error(`${field}_too_long`);
  return normalized;
}

export function normalizeCourseRewardTierInput(input: {
  title: string;
  description?: string | null;
  fulfillmentInstructions?: string | null;
  requiredScore: number;
}) {
  if (
    !Number.isInteger(input.requiredScore) ||
    input.requiredScore < 0 ||
    input.requiredScore > 100
  ) {
    throw new Error("required_score_invalid");
  }
  return {
    title: normalizeRequiredText(input.title, "title", COURSE_REWARD_TITLE_MAX),
    description: normalizeOptionalText(
      input.description,
      "description",
      COURSE_REWARD_DESCRIPTION_MAX
    ),
    fulfillmentInstructions: normalizeOptionalText(
      input.fulfillmentInstructions,
      "fulfillment_instructions",
      COURSE_REWARD_INSTRUCTIONS_MAX
    ),
    requiredScore: input.requiredScore,
  };
}

export function normalizeCourseRewardResolutionReason(
  value: string | null | undefined,
  options: { required: boolean }
): string | null {
  const normalized = normalizeOptionalText(
    value,
    "resolution_reason",
    COURSE_REWARD_RESOLUTION_REASON_MAX
  );
  if (
    options.required &&
    (normalized === null ||
      normalized.length < COURSE_REWARD_RESOLUTION_REASON_MIN)
  ) {
    throw new Error("resolution_reason_too_short");
  }
  return normalized;
}

/**
 * Returns the same published Score Total used by the gradebook plus the exact
 * numerator and denominator frozen into a reward claim.
 */
export function courseRewardScoreSnapshot(
  items: readonly ScoreItemInput[],
  entries: readonly ScoreEntryInput[]
): CourseRewardScoreSnapshot | null {
  const percent = scoreTotal(items, entries);
  if (percent === null) return null;

  const entryByItem = new Map(
    entries.map((row) => [row.scoreItemId, row.value])
  );
  let earnedScore = 0;
  let publishedFullScore = 0;
  for (const item of items) {
    if (item.publishedAt === null || item.fullScore <= 0) continue;
    earnedScore += entryByItem.get(item.id) ?? 0;
    publishedFullScore += item.fullScore;
  }

  return { percent, earnedScore, publishedFullScore };
}

/** Integer cross multiplication avoids floating-point boundary surprises. */
export function scoreSnapshotMeetsThreshold(
  snapshot: CourseRewardScoreSnapshot,
  requiredScore: number
): boolean {
  return (
    snapshot.earnedScore * 100 >= requiredScore * snapshot.publishedFullScore
  );
}

export function highestEligibleCourseRewardTier<
  T extends Readonly<{ requiredScore: number }>,
>(tiers: readonly T[], snapshot: CourseRewardScoreSnapshot): T | null {
  let highest: T | null = null;
  for (const tier of tiers) {
    if (!scoreSnapshotMeetsThreshold(snapshot, tier.requiredScore)) continue;
    if (highest === null || tier.requiredScore > highest.requiredScore) {
      highest = tier;
    }
  }
  return highest;
}
