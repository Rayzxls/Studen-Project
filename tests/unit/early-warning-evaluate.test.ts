import { describe, expect, it } from "vitest";
import {
  evaluateEarlyWarning,
  type EarlyWarningSnapshot,
} from "@/lib/early-warning/evaluate";

function snapshot(
  overrides: Partial<EarlyWarningSnapshot> = {}
): EarlyWarningSnapshot {
  return {
    enrollmentId: "enrollment-1",
    studentUserId: "student-1",
    studentName: "กานต์ ใจดี",
    courseId: "course-1",
    courseName: "คณิตศาสตร์",
    learnerGroupLabel: "ม.4/1",
    attendance: { present: 0, late: 0, excused: 0, absent: 0 },
    missingAssignments: 0,
    scoreItems: [],
    ...overrides,
  };
}

describe("evaluateEarlyWarning", () => {
  it("does not label a student before a documented signal fires", () => {
    expect(
      evaluateEarlyWarning(
        snapshot({
          attendance: { present: 1, late: 0, excused: 0, absent: 1 },
          missingAssignments: 1,
        })
      )
    ).toBeNull();
  });

  it("flags low attendance only after at least three marked sessions", () => {
    const warning = evaluateEarlyWarning(
      snapshot({
        attendance: { present: 1, late: 1, excused: 0, absent: 1 },
      })
    );

    expect(warning).toMatchObject({
      severity: "WATCH",
      signals: [{ kind: "ATTENDANCE", rate: 67, marked: 3 }],
    });
  });

  it("uses two weighted score windows and counts a missing published entry as zero", () => {
    const warning = evaluateEarlyWarning(
      snapshot({
        scoreItems: [
          {
            scoreItemId: "recent-2",
            fullScore: 20,
            value: null,
            publishedAt: new Date("2026-07-22T00:00:00Z"),
          },
          {
            scoreItemId: "previous-1",
            fullScore: 10,
            value: 9,
            publishedAt: new Date("2026-07-08T00:00:00Z"),
          },
          {
            scoreItemId: "recent-1",
            fullScore: 10,
            value: 5,
            publishedAt: new Date("2026-07-15T00:00:00Z"),
          },
          {
            scoreItemId: "previous-2",
            fullScore: 20,
            value: 18,
            publishedAt: new Date("2026-07-01T00:00:00Z"),
          },
        ],
      })
    );

    expect(warning?.signals).toEqual([
      {
        kind: "SCORE_DROP",
        drop: 73,
        recentPercent: 17,
        previousPercent: 90,
      },
    ]);
  });

  it("raises urgency only when different evidence streams agree", () => {
    const warning = evaluateEarlyWarning(
      snapshot({
        attendance: { present: 2, late: 0, excused: 0, absent: 2 },
        missingAssignments: 2,
      })
    );

    expect(warning).toMatchObject({
      severity: "URGENT",
      signals: [
        { kind: "ATTENDANCE", rate: 50 },
        { kind: "MISSING_WORK", count: 2 },
      ],
    });
  });
});
