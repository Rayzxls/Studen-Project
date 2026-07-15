import { beforeEach, describe, expect, it, vi } from "vitest";
import { Forbidden } from "@/lib/errors";

const mocks = vi.hoisted(() => ({
  ownsCourse: vi.fn(),
  getScoreboard: vi.fn(),
  getAttendanceSummary: vi.fn(),
  audit: vi.fn(),
  getRequestMeta: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  assert: { ownsCourse: mocks.ownsCourse },
}));
vi.mock("@/lib/scoring/queries", () => ({
  getScoreboardForTeacher: mocks.getScoreboard,
}));
vi.mock("@/lib/attendance/queries", () => ({
  getAttendanceSummaryForTeacher: mocks.getAttendanceSummary,
}));
vi.mock("@/lib/audit/log", () => ({ audit: mocks.audit }));
vi.mock("@/lib/utils/request", () => ({
  getRequestMeta: mocks.getRequestMeta,
}));

import { GET as exportScores } from "@/app/teacher/courses/[id]/scores/export/route";
import { GET as exportAttendance } from "@/app/teacher/courses/[id]/attendance/export/route";

const context = { params: Promise.resolve({ id: "course-1" }) };

describe("Teacher report routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ownsCourse.mockResolvedValue({
      session: { user: { id: "teacher-1", role: "TEACHER" } },
      course: { id: "course-1", name: "ENG" },
    });
    mocks.getRequestMeta.mockResolvedValue({
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });
    mocks.audit.mockResolvedValue(undefined);
  });

  it("rejects score export when the ownership guard fails", async () => {
    mocks.ownsCourse.mockRejectedValue(new Forbidden("not_course_owner"));

    const response = await exportScores(
      new Request("http://localhost/course-scores"),
      context
    );

    expect(response.status).toBe(403);
    expect(mocks.getScoreboard).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("downloads the owning Teacher's score CSV and writes an audit row", async () => {
    mocks.getScoreboard.mockResolvedValue({
      items: [],
      rows: [
        {
          enrollmentId: "e1",
          studentUserId: "u1",
          studentId: "36901234",
          firstName: "Student",
          lastName: "One",
          removedAt: null,
          entries: [],
        },
      ],
    });

    const response = await exportScores(
      new Request("http://localhost/course-scores"),
      context
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(
      "course-scores-course-1.csv"
    );
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(mocks.getScoreboard).toHaveBeenCalledWith("course-1", "teacher-1");
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CLASS_ANALYTICS_EXPORTED",
        actorId: "teacher-1",
        targetId: "course-1",
        after: expect.objectContaining({
          reportType: "teacher_score_summary_csv",
        }),
      })
    );
  });

  it("downloads attendance CSV from the same ownership boundary", async () => {
    mocks.getAttendanceSummary.mockResolvedValue({
      totalSessions: 0,
      rows: [],
    });

    const response = await exportAttendance(
      new Request("http://localhost/course-attendance"),
      context
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(
      "course-attendance-course-1.csv"
    );
    expect(mocks.getAttendanceSummary).toHaveBeenCalledWith(
      "course-1",
      "teacher-1"
    );
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CLASS_ANALYTICS_EXPORTED",
        after: expect.objectContaining({
          reportType: "teacher_attendance_summary_csv",
        }),
      })
    );
  });
});
