/**
 * Pure unit tests — lib/feed/navigation
 *
 * Locks Q3 lock (student-only) URL pattern and Q5 fallback policy:
 * MATERIAL / ANNOUNCEMENT have no UI yet → fall back to course root.
 */

import { describe, expect, it } from "vitest";
import { resolveFeedHref } from "@/lib/feed/navigation";

const COURSE = "course-abc";

describe("resolveFeedHref", () => {
  it("ASSIGNMENT deep-links to the assignment detail", () => {
    expect(
      resolveFeedHref({
        kind: "ASSIGNMENT",
        courseOfferingId: COURSE,
        itemId: "assignment-1",
      })
    ).toBe(`/student/courses/${COURSE}/assignments/assignment-1`);
  });

  it("SCORE_PUBLISHED routes to the scores tab", () => {
    expect(
      resolveFeedHref({
        kind: "SCORE_PUBLISHED",
        courseOfferingId: COURSE,
        itemId: "score-item-1",
      })
    ).toBe(`/student/courses/${COURSE}/scores`);
  });

  it("MATERIAL deep-links to material detail (P9-1)", () => {
    expect(
      resolveFeedHref({
        kind: "MATERIAL",
        courseOfferingId: COURSE,
        itemId: "material-1",
      })
    ).toBe(`/student/courses/${COURSE}/materials/material-1`);
  });

  it("ANNOUNCEMENT deep-links to announcement detail (P9-1)", () => {
    expect(
      resolveFeedHref({
        kind: "ANNOUNCEMENT",
        courseOfferingId: COURSE,
        itemId: "announcement-1",
      })
    ).toBe(`/student/courses/${COURSE}/announcements/announcement-1`);
  });
});
