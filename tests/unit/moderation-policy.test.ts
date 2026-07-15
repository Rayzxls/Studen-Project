import { describe, expect, it } from "vitest";
import {
  MODERATION_APPEAL_WINDOW_MS,
  appealDeadlineFrom,
  decideAppeal,
  decideCloseCase,
  decideRestoreRestriction,
  decideStartReview,
  decideTemporaryRestriction,
} from "@/lib/moderation/policy";

describe("moderation case policy", () => {
  it("starts review only from open or appealed", () => {
    expect(decideStartReview("OPEN")).toEqual({
      allowed: true,
      nextStatus: "IN_REVIEW",
    });
    expect(decideStartReview("APPEALED")).toEqual({
      allowed: true,
      nextStatus: "IN_REVIEW",
    });
    expect(decideStartReview("RESOLVED")).toEqual({
      allowed: false,
      code: "moderation_case_not_reviewable",
    });
  });

  it("requires active review before applying or restoring a restriction", () => {
    expect(
      decideTemporaryRestriction({
        status: "OPEN",
        currentRestriction: null,
        requested: "HIDDEN",
      })
    ).toEqual({
      allowed: false,
      code: "moderation_case_review_required",
    });
    expect(
      decideTemporaryRestriction({
        status: "IN_REVIEW",
        currentRestriction: null,
        requested: "HIDDEN",
      })
    ).toEqual({ allowed: true, nextStatus: "IN_REVIEW" });
    expect(
      decideTemporaryRestriction({
        status: "IN_REVIEW",
        currentRestriction: "HIDDEN",
        requested: "HIDDEN",
      })
    ).toEqual({
      allowed: false,
      code: "moderation_target_already_restricted",
    });
    expect(
      decideRestoreRestriction({
        status: "IN_REVIEW",
        currentRestriction: null,
      })
    ).toEqual({
      allowed: false,
      code: "moderation_target_not_restricted",
    });
  });

  it("closes only a case currently in review", () => {
    expect(
      decideCloseCase({ status: "IN_REVIEW", outcome: "RESOLVED" })
    ).toEqual({ allowed: true, nextStatus: "RESOLVED" });
    expect(decideCloseCase({ status: "OPEN", outcome: "DISMISSED" })).toEqual({
      allowed: false,
      code: "moderation_case_review_required",
    });
  });

  it("allows the content owner one appeal inside seven days", () => {
    const resolvedAt = new Date("2026-07-15T00:00:00.000Z");
    const deadline = appealDeadlineFrom(resolvedAt);
    expect(deadline.getTime() - resolvedAt.getTime()).toBe(
      MODERATION_APPEAL_WINDOW_MS
    );
    expect(
      decideAppeal({
        status: "RESOLVED",
        actorUserId: "owner",
        ownerUserId: "owner",
        appealUsed: false,
        appealDeadline: deadline,
        now: new Date("2026-07-21T23:59:59.000Z"),
      })
    ).toEqual({ allowed: true, nextStatus: "APPEALED" });
  });

  it("rejects non-owner, repeated, and late appeals", () => {
    const base = {
      status: "RESOLVED" as const,
      ownerUserId: "owner",
      appealDeadline: new Date("2026-07-22T00:00:00.000Z"),
      now: new Date("2026-07-16T00:00:00.000Z"),
    };
    expect(
      decideAppeal({
        ...base,
        actorUserId: "other",
        appealUsed: false,
      })
    ).toEqual({
      allowed: false,
      code: "moderation_appeal_owner_required",
    });
    expect(
      decideAppeal({ ...base, actorUserId: "owner", appealUsed: true })
    ).toEqual({
      allowed: false,
      code: "moderation_appeal_already_used",
    });
    expect(
      decideAppeal({
        ...base,
        actorUserId: "owner",
        appealUsed: false,
        now: new Date("2026-07-22T00:00:00.001Z"),
      })
    ).toEqual({
      allowed: false,
      code: "moderation_appeal_window_closed",
    });
  });
});
