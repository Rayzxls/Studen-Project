/**
 * Pure unit tests — lib/audit/tier
 *
 * Locks the per-action tier dispatch + the Admin × PRIVATE
 * COMMENT_MODERATED escalation to CRITICAL.
 */

import { describe, expect, it } from "vitest";
import { tierFor, tierForRow, actionsForTier } from "@/lib/audit/tier";

describe("tierFor — per-action default tier", () => {
  it("classifies CRITICAL events", () => {
    for (const a of [
      "SCORE_EDIT_AFTER_PUBLISH",
      "SCORE_DELETE_AFTER_PUBLISH",
      "PASSWORD_RESET_BY_OTHER",
      "ROLE_CHANGE",
      "USER_LOCKED",
      "USER_ANONYMIZED",
      "COURSE_MEMBER_REMOVED",
      "SESSION_CANCELLED",
      "FILE_INFECTED_BLOCKED",
    ]) {
      expect(tierFor(a)).toBe("CRITICAL");
    }
  });

  it("classifies IMPORTANT events", () => {
    for (const a of [
      "LOGIN_SUCCESS",
      "LOGIN_FAILED",
      "CSV_IMPORT",
      "ATTENDANCE_BACK_EDIT",
      "CLASS_CODE_REGENERATED",
      "ASSIGNMENT_UPDATED",
      "SUBMISSION_RETURNED",
      "COURSE_MEMBER_JOINED",
      "FILE_UPLOADED",
      "MATERIAL_DELETED",
      "ANNOUNCEMENT_DELETED",
      "SCORE_ITEM_PUBLISHED",
      "ADMIN_AUDIT_EXPORTED",
      "CLASS_ANALYTICS_EXPORTED",
      "LESSON_ARCHIVED",
      "LESSON_DELETED",
      "LESSON_CONTENT_MOVED",
      "TEACHER_INVITE_ISSUED",
      "TEACHER_INVITE_REPLACED",
      "TEACHER_INVITE_REVOKED",
      "TEACHER_INVITE_ACCEPTED",
    ]) {
      expect(tierFor(a)).toBe("IMPORTANT");
    }
  });

  it("returns VERBOSE for unknown / legacy actions", () => {
    expect(tierFor("UNKNOWN_LEGACY_EVENT")).toBe("VERBOSE");
    expect(tierFor("")).toBe("VERBOSE");
  });
});

describe("tierForRow — Admin × PRIVATE COMMENT_MODERATED escalation", () => {
  it("Teacher moderating a CLASS_WIDE comment stays IMPORTANT", () => {
    expect(
      tierForRow({
        action: "COMMENT_MODERATED",
        actorRole: "TEACHER",
        beforeScope: "CLASS_WIDE",
      })
    ).toBe("IMPORTANT");
  });

  it("Teacher moderating a PRIVATE comment stays IMPORTANT (no escalation)", () => {
    expect(
      tierForRow({
        action: "COMMENT_MODERATED",
        actorRole: "TEACHER",
        beforeScope: "PRIVATE",
      })
    ).toBe("IMPORTANT");
  });

  it("Admin moderating a CLASS_WIDE comment stays IMPORTANT", () => {
    expect(
      tierForRow({
        action: "COMMENT_MODERATED",
        actorRole: "ADMIN",
        beforeScope: "CLASS_WIDE",
      })
    ).toBe("IMPORTANT");
  });

  it("Admin × PRIVATE escalates to CRITICAL", () => {
    expect(
      tierForRow({
        action: "COMMENT_MODERATED",
        actorRole: "ADMIN",
        beforeScope: "PRIVATE",
      })
    ).toBe("CRITICAL");
  });

  it("non-COMMENT_MODERATED actions use the per-action tier regardless of role/scope", () => {
    expect(
      tierForRow({
        action: "USER_LOCKED",
        actorRole: "ADMIN",
        beforeScope: "PRIVATE",
      })
    ).toBe("CRITICAL");
    expect(
      tierForRow({
        action: "LOGIN_SUCCESS",
        actorRole: "ADMIN",
        beforeScope: "PRIVATE",
      })
    ).toBe("IMPORTANT");
  });
});

describe("actionsForTier — flat action lists for WHERE IN (…)", () => {
  it("returns the full CRITICAL set", () => {
    const arr = actionsForTier("CRITICAL");
    expect(arr).toContain("USER_LOCKED");
    expect(arr).toContain("SCORE_DELETE_AFTER_PUBLISH");
    expect(arr).not.toContain("LOGIN_SUCCESS");
  });

  it("returns the full IMPORTANT set", () => {
    const arr = actionsForTier("IMPORTANT");
    expect(arr).toContain("LOGIN_SUCCESS");
    expect(arr).toContain("CSV_IMPORT");
    expect(arr).toContain("TEACHER_INVITE_REVOKED");
    expect(arr).not.toContain("USER_LOCKED");
  });

  it("returns empty for VERBOSE (caller composes NOT IN predicate)", () => {
    expect(actionsForTier("VERBOSE")).toEqual([]);
  });
});
