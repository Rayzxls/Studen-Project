export const MODERATION_APPEAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type ModerationCaseStatus =
  | "OPEN"
  | "IN_REVIEW"
  | "RESOLVED"
  | "DISMISSED"
  | "APPEALED";

export type ModerationRestrictionKind = "HIDDEN" | "QUARANTINED";

export type ModerationDecision =
  | { allowed: true; nextStatus: ModerationCaseStatus }
  | { allowed: false; code: string };

export function decideStartReview(
  status: ModerationCaseStatus
): ModerationDecision {
  if (status !== "OPEN" && status !== "APPEALED") {
    return { allowed: false, code: "moderation_case_not_reviewable" };
  }
  return { allowed: true, nextStatus: "IN_REVIEW" };
}

export function decideTemporaryRestriction(input: {
  status: ModerationCaseStatus;
  currentRestriction: ModerationRestrictionKind | null;
  requested: ModerationRestrictionKind;
}): ModerationDecision {
  if (input.status !== "IN_REVIEW") {
    return { allowed: false, code: "moderation_case_review_required" };
  }
  if (input.currentRestriction !== null) {
    return { allowed: false, code: "moderation_target_already_restricted" };
  }
  return { allowed: true, nextStatus: "IN_REVIEW" };
}

export function decideRestoreRestriction(input: {
  status: ModerationCaseStatus;
  currentRestriction: ModerationRestrictionKind | null;
}): ModerationDecision {
  if (input.status !== "IN_REVIEW") {
    return { allowed: false, code: "moderation_case_review_required" };
  }
  if (input.currentRestriction === null) {
    return { allowed: false, code: "moderation_target_not_restricted" };
  }
  return { allowed: true, nextStatus: "IN_REVIEW" };
}

export function decideCloseCase(input: {
  status: ModerationCaseStatus;
  outcome: "RESOLVED" | "DISMISSED";
}): ModerationDecision {
  if (input.status !== "IN_REVIEW") {
    return { allowed: false, code: "moderation_case_review_required" };
  }
  return { allowed: true, nextStatus: input.outcome };
}

export function decideAppeal(input: {
  status: ModerationCaseStatus;
  actorUserId: string;
  ownerUserId: string | null;
  appealUsed: boolean;
  appealDeadline: Date | null;
  now: Date;
}): ModerationDecision {
  if (input.status !== "RESOLVED") {
    return { allowed: false, code: "moderation_case_not_appealable" };
  }
  if (!input.ownerUserId || input.actorUserId !== input.ownerUserId) {
    return { allowed: false, code: "moderation_appeal_owner_required" };
  }
  if (input.appealUsed) {
    return { allowed: false, code: "moderation_appeal_already_used" };
  }
  if (!input.appealDeadline || input.now > input.appealDeadline) {
    return { allowed: false, code: "moderation_appeal_window_closed" };
  }
  return { allowed: true, nextStatus: "APPEALED" };
}

export function appealDeadlineFrom(resolvedAt: Date): Date {
  return new Date(resolvedAt.getTime() + MODERATION_APPEAL_WINDOW_MS);
}
