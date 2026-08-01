import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enrollmentFindMany: vi.fn(),
  attendanceGroupBy: vi.fn(),
  assignmentFindMany: vi.fn(),
  submissionFindMany: vi.fn(),
  scoreItemFindMany: vi.fn(),
  scoreEntryFindMany: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    enrollment: { findMany: mocks.enrollmentFindMany },
    attendanceRecord: { groupBy: mocks.attendanceGroupBy },
    assignment: { findMany: mocks.assignmentFindMany },
    submission: { findMany: mocks.submissionFindMany },
    scoreItem: { findMany: mocks.scoreItemFindMany },
    scoreEntry: { findMany: mocks.scoreEntryFindMany },
  },
}));

import { getTeacherEarlyWarnings } from "@/lib/early-warning/teacher";

const NOW = new Date("2026-08-01T05:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enrollmentFindMany.mockResolvedValue([]);
  mocks.attendanceGroupBy.mockResolvedValue([]);
  mocks.assignmentFindMany.mockResolvedValue([]);
  mocks.submissionFindMany.mockResolvedValue([]);
  mocks.scoreItemFindMany.mockResolvedValue([]);
  mocks.scoreEntryFindMany.mockResolvedValue([]);
});

describe("getTeacherEarlyWarnings", () => {
  it("stops after the ownership-scoped enrollment read when there are no students", async () => {
    await expect(getTeacherEarlyWarnings("teacher-1", NOW)).resolves.toEqual({
      total: 0,
      urgentCount: 0,
      watchCount: 0,
      rows: [],
    });

    expect(mocks.enrollmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          removedAt: null,
          course: { teacherId: "teacher-1", archivedAt: null },
        },
      })
    );
    expect(mocks.attendanceGroupBy).not.toHaveBeenCalled();
  });

  it("joins owned evidence and ignores assignments due before a late joiner enrolled", async () => {
    mocks.enrollmentFindMany.mockResolvedValue([
      {
        id: "enrollment-1",
        enrolledAt: new Date("2026-07-10T00:00:00Z"),
        student: {
          userId: "student-1",
          firstName: "กานต์",
          lastName: "ใจดี",
        },
        course: {
          id: "course-1",
          name: "คณิตศาสตร์",
          learnerGroupLabel: "ม.4/1",
        },
      },
    ]);
    mocks.attendanceGroupBy.mockResolvedValue([
      { enrollmentId: "enrollment-1", status: "PRESENT", _count: { _all: 1 } },
      { enrollmentId: "enrollment-1", status: "ABSENT", _count: { _all: 3 } },
    ]);
    mocks.assignmentFindMany.mockResolvedValue([
      {
        id: "before-enrollment",
        courseOfferingId: "course-1",
        dueAt: new Date("2026-07-05T00:00:00Z"),
      },
      {
        id: "missing-1",
        courseOfferingId: "course-1",
        dueAt: new Date("2026-07-20T00:00:00Z"),
      },
      {
        id: "missing-2",
        courseOfferingId: "course-1",
        dueAt: new Date("2026-07-25T00:00:00Z"),
      },
    ]);
    mocks.scoreItemFindMany.mockResolvedValue([
      {
        id: "score-4",
        courseOfferingId: "course-1",
        fullScore: 20,
        publishedAt: new Date("2026-07-28T00:00:00Z"),
      },
      {
        id: "score-3",
        courseOfferingId: "course-1",
        fullScore: 20,
        publishedAt: new Date("2026-07-21T00:00:00Z"),
      },
      {
        id: "score-2",
        courseOfferingId: "course-1",
        fullScore: 20,
        publishedAt: new Date("2026-07-14T00:00:00Z"),
      },
      {
        id: "score-1",
        courseOfferingId: "course-1",
        fullScore: 20,
        publishedAt: new Date("2026-07-12T00:00:00Z"),
      },
    ]);
    mocks.scoreEntryFindMany.mockResolvedValue([
      { enrollmentId: "enrollment-1", scoreItemId: "score-4", value: 8 },
      { enrollmentId: "enrollment-1", scoreItemId: "score-3", value: 10 },
      { enrollmentId: "enrollment-1", scoreItemId: "score-2", value: 18 },
      { enrollmentId: "enrollment-1", scoreItemId: "score-1", value: 20 },
    ]);

    const result = await getTeacherEarlyWarnings("teacher-1", NOW);

    expect(result).toMatchObject({
      total: 1,
      urgentCount: 1,
      rows: [
        {
          studentName: "กานต์ ใจดี",
          severity: "URGENT",
          signals: [
            { kind: "ATTENDANCE", rate: 25 },
            { kind: "MISSING_WORK", count: 2 },
            { kind: "SCORE_DROP", drop: 50 },
          ],
        },
      ],
    });
    expect(mocks.assignmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          courseOfferingId: { in: ["course-1"] },
          dueAt: { lt: NOW },
          AND: [{ OR: [{ publishAt: null }, { publishAt: { lte: NOW } }] }],
        }),
      })
    );
    expect(mocks.attendanceGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          enrollmentId: { in: ["enrollment-1"] },
          session: { cancelledAt: null },
        },
      })
    );
    expect(mocks.submissionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          enrollmentId: { in: ["enrollment-1"] },
          assignmentId: {
            in: ["before-enrollment", "missing-1", "missing-2"],
          },
        }),
      })
    );
    expect(mocks.scoreEntryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          enrollmentId: { in: ["enrollment-1"] },
          scoreItemId: {
            in: ["score-4", "score-3", "score-2", "score-1"],
          },
        },
      })
    );
  });
});
