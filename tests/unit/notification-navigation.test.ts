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

  it("SUBMISSION_GRADED deep-links to assignment detail when payload has assignmentId (P9-1)", () => {
    expect(
      resolveNotificationHref({
        kind: "SUBMISSION_GRADED",
        role: "STUDENT",
        courseOfferingId: COURSE_ID,
        sourceEntityId: "submission-7",
        payload: { assignmentId: "assignment-99" },
      })
    ).toBe(`/student/courses/${COURSE_ID}/assignments/assignment-99`);
  });

  it("SUBMISSION_GRADED falls back to the list for legacy rows (no assignmentId)", () => {
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

  it("SUBMISSION_RETURNED deep-links to assignment detail (P9-1)", () => {
    expect(
      resolveNotificationHref({
        kind: "SUBMISSION_RETURNED",
        role: "STUDENT",
        courseOfferingId: COURSE_ID,
        sourceEntityId: "submission-7",
        payload: { assignmentId: "assignment-99" },
      })
    ).toBe(`/student/courses/${COURSE_ID}/assignments/assignment-99`);
  });

  it("MATERIAL_POSTED deep-links to material detail (P7-8 routes live)", () => {
    expect(
      resolveNotificationHref({
        kind: "MATERIAL_POSTED",
        role: "STUDENT",
        courseOfferingId: COURSE_ID,
        sourceEntityId: "material-3",
        payload: {},
      })
    ).toBe(`/student/courses/${COURSE_ID}/materials/material-3`);
  });

  it("ANNOUNCEMENT_POSTED deep-links to announcement detail (P7-8 routes live)", () => {
    expect(
      resolveNotificationHref({
        kind: "ANNOUNCEMENT_POSTED",
        role: "STUDENT",
        courseOfferingId: COURSE_ID,
        sourceEntityId: "ann-3",
        payload: {},
      })
    ).toBe(`/student/courses/${COURSE_ID}/announcements/ann-3`);
  });

  it("COMMENT_REPLIED with entityKind=ASSIGNMENT deep-links via entityOwnerId (P9-1)", () => {
    expect(
      resolveNotificationHref({
        kind: "COMMENT_REPLIED",
        role: "STUDENT",
        courseOfferingId: COURSE_ID,
        sourceEntityId: "comment-3",
        payload: { entityKind: "ASSIGNMENT", entityOwnerId: "assignment-9" },
      })
    ).toBe(`/student/courses/${COURSE_ID}/assignments/assignment-9`);
  });

  it("COMMENT_REPLIED on MATERIAL deep-links to material detail", () => {
    expect(
      resolveNotificationHref({
        kind: "COMMENT_REPLIED",
        role: "STUDENT",
        courseOfferingId: COURSE_ID,
        sourceEntityId: "comment-3",
        payload: { entityKind: "MATERIAL", entityOwnerId: "material-5" },
      })
    ).toBe(`/student/courses/${COURSE_ID}/materials/material-5`);
  });

  it("COMMENT_REPLIED on SUBMISSION lands on the parent assignment (entityOwnerId = Assignment.id)", () => {
    expect(
      resolveNotificationHref({
        kind: "COMMENT_REPLIED",
        role: "STUDENT",
        courseOfferingId: COURSE_ID,
        sourceEntityId: "comment-3",
        payload: { entityKind: "SUBMISSION", entityOwnerId: "assignment-9" },
      })
    ).toBe(`/student/courses/${COURSE_ID}/assignments/assignment-9`);
  });

  it("COMMENT_REPLIED falls back to course root when payload is malformed", () => {
    expect(
      resolveNotificationHref({
        kind: "COMMENT_REPLIED",
        role: "STUDENT",
        courseOfferingId: COURSE_ID,
        sourceEntityId: "comment-3",
        payload: {},
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

  it("COMMENT_REPLIED deep-links to teacher-side assignment detail (P9-1)", () => {
    expect(
      resolveNotificationHref({
        kind: "COMMENT_REPLIED",
        role: "TEACHER",
        courseOfferingId: COURSE_ID,
        sourceEntityId: "comment-3",
        payload: { entityKind: "ASSIGNMENT", entityOwnerId: "assignment-9" },
      })
    ).toBe(`/teacher/courses/${COURSE_ID}/assignments/assignment-9`);
  });

  it("COMMENT_REPLIED on MATERIAL deep-links to teacher Material detail", () => {
    expect(
      resolveNotificationHref({
        kind: "COMMENT_REPLIED",
        role: "TEACHER",
        courseOfferingId: COURSE_ID,
        sourceEntityId: "comment-3",
        payload: { entityKind: "MATERIAL", entityOwnerId: "material-5" },
      })
    ).toBe(`/teacher/courses/${COURSE_ID}/materials/material-5`);
  });

  it("COMMENT_REPLIED falls back when payload lacks entityOwnerId", () => {
    expect(
      resolveNotificationHref({
        kind: "COMMENT_REPLIED",
        role: "TEACHER",
        courseOfferingId: COURSE_ID,
        sourceEntityId: "comment-3",
        payload: {},
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
