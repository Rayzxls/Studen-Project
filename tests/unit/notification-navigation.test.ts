/**
 * Pure unit tests — lib/notification/navigation
 *
 * Locks the Q5 resolution policy: deep-link where the snapshot
 * addresses the entity, fall back to course root (or one tab up) when
 * the payload lacks the id, and fall back to /dashboard when the
 * course context is missing entirely.
 */

import { describe, expect, it } from "vitest";
import { resolveNotificationHref } from "@/lib/notification/navigation";

const COURSE_ID = "course-abc";

describe("resolveNotificationHref — STUDENT recipient", () => {
  it("SCORE_ITEM_PUBLISHED → /student/courses/{id}/scores", () => {
    expect(
      resolveNotificationHref({
        kind: "SCORE_ITEM_PUBLISHED",
        role: "STUDENT",
        courseOfferingId: COURSE_ID,
        sourceEntityId: "score-item-1",
        payload: { itemName: "Quiz 1" },
      })
    ).toBe(`/student/courses/${COURSE_ID}/scores`);
  });

  it("SCORE_ENTRY_EDITED → /student/courses/{id}/scores", () => {
    expect(
      resolveNotificationHref({
        kind: "SCORE_ENTRY_EDITED",
        role: "STUDENT",
        courseOfferingId: COURSE_ID,
        sourceEntityId: "score-item-1",
        payload: {},
      })
    ).toBe(`/student/courses/${COURSE_ID}/scores`);
  });

  it("ASSIGNMENT_POSTED deep-links to /assignments/{sourceEntityId}", () => {
    expect(
      resolveNotificationHref({
        kind: "ASSIGNMENT_POSTED",
        role: "STUDENT",
        courseOfferingId: COURSE_ID,
        sourceEntityId: "assignment-99",
        payload: { assignmentTitle: "HW 5" },
      })
    ).toBe(`/student/courses/${COURSE_ID}/assignments/assignment-99`);
  });

  it("SUBMISSION_GRADED falls back to the assignments list (no assignmentId in payload)", () => {
    expect(
      resolveNotificationHref({
        kind: "SUBMISSION_GRADED",
        role: "STUDENT",
        courseOfferingId: COURSE_ID,
        sourceEntityId: "submission-7",
        payload: {},
      })
    ).toBe(`/student/courses/${COURSE_ID}/assignments`);
  });

  it("SUBMISSION_RETURNED falls back to the assignments list", () => {
    expect(
      resolveNotificationHref({
        kind: "SUBMISSION_RETURNED",
        role: "STUDENT",
        courseOfferingId: COURSE_ID,
        sourceEntityId: "submission-7",
        payload: {},
      })
    ).toBe(`/student/courses/${COURSE_ID}/assignments`);
  });

  it("MATERIAL_POSTED falls back to course root (no UI yet)", () => {
    expect(
      resolveNotificationHref({
        kind: "MATERIAL_POSTED",
        role: "STUDENT",
        courseOfferingId: COURSE_ID,
        sourceEntityId: "material-3",
        payload: {},
      })
    ).toBe(`/student/courses/${COURSE_ID}`);
  });

  it("ANNOUNCEMENT_POSTED falls back to course root (no UI yet)", () => {
    expect(
      resolveNotificationHref({
        kind: "ANNOUNCEMENT_POSTED",
        role: "STUDENT",
        courseOfferingId: COURSE_ID,
        sourceEntityId: "ann-3",
        payload: {},
      })
    ).toBe(`/student/courses/${COURSE_ID}`);
  });

  it("COMMENT_REPLIED falls back to course root", () => {
    expect(
      resolveNotificationHref({
        kind: "COMMENT_REPLIED",
        role: "STUDENT",
        courseOfferingId: COURSE_ID,
        sourceEntityId: "comment-3",
        payload: { entityKind: "ASSIGNMENT" },
      })
    ).toBe(`/student/courses/${COURSE_ID}`);
  });
});

describe("resolveNotificationHref — TEACHER recipient", () => {
  it("CLASS_CODE_JOINED → /teacher/courses/{id}/members", () => {
    expect(
      resolveNotificationHref({
        kind: "CLASS_CODE_JOINED",
        role: "TEACHER",
        courseOfferingId: COURSE_ID,
        sourceEntityId: "enrollment-1",
        payload: { studentName: "สมชาย" },
      })
    ).toBe(`/teacher/courses/${COURSE_ID}/members`);
  });

  it("COMMENT_REPLIED → /teacher/courses/{id} (no deep link yet)", () => {
    expect(
      resolveNotificationHref({
        kind: "COMMENT_REPLIED",
        role: "TEACHER",
        courseOfferingId: COURSE_ID,
        sourceEntityId: "comment-3",
        payload: { entityKind: "ASSIGNMENT" },
      })
    ).toBe(`/teacher/courses/${COURSE_ID}`);
  });

  it("any other kind → /teacher/courses/{id} fallback", () => {
    expect(
      resolveNotificationHref({
        kind: "ASSIGNMENT_POSTED",
        role: "TEACHER",
        courseOfferingId: COURSE_ID,
        sourceEntityId: "assignment-99",
        payload: {},
      })
    ).toBe(`/teacher/courses/${COURSE_ID}`);
  });
});

describe("resolveNotificationHref — fallbacks", () => {
  it("returns /dashboard when courseOfferingId is null", () => {
    expect(
      resolveNotificationHref({
        kind: "ASSIGNMENT_POSTED",
        role: "STUDENT",
        courseOfferingId: null,
        sourceEntityId: "x",
        payload: {},
      })
    ).toBe("/dashboard");
  });

  it("returns /dashboard for ADMIN regardless of kind", () => {
    expect(
      resolveNotificationHref({
        kind: "ASSIGNMENT_POSTED",
        role: "ADMIN",
        courseOfferingId: COURSE_ID,
        sourceEntityId: "a",
        payload: {},
      })
    ).toBe("/dashboard");
  });
});
