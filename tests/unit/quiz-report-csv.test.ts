import { describe, expect, it } from "vitest";
import type { TeacherQuizResultsView } from "@/lib/quiz";
import { buildTeacherQuizCsv } from "@/lib/report/teacher-quiz";

describe("Teacher Quiz CSV", () => {
  it("exports summary, Student results, and item analysis safely", () => {
    const result = fixture();
    const csv = buildTeacherQuizCsv(result);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("ผลรายคน");
    expect(csv).toContain("วิเคราะห์รายข้อ");
    expect(csv).toContain('"65001","Ada Lovelace","ส่งแล้ว","2","8"');
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('"1","\'=HYPERLINK(""https://bad.example"")","10"');
  });
});

function fixture(): TeacherQuizResultsView {
  return {
    id: "quiz-1",
    courseOfferingId: "course-1",
    lessonId: "lesson-1",
    lessonTitle: "บทที่ 1",
    title: '=HYPERLINK("https://bad.example")',
    mode: "SCORED",
    status: "CLOSED",
    closesAt: new Date("2026-07-18T02:00:00.000Z"),
    passThresholdPercent: 60,
    totalPoints: 10,
    publishedAt: null,
    counts: { total: 1, notStarted: 0, inProgress: 0, submitted: 1 },
    metrics: {
      average: 8,
      highest: 8,
      lowest: 8,
      passCount: 1,
      passRate: 100,
      averageDurationSeconds: 300,
    },
    students: [
      {
        enrollmentId: "enrollment-1",
        studentUserId: "student-1",
        studentCode: "65001",
        name: "Ada Lovelace",
        status: "SUBMITTED",
        attemptCount: 2,
        bestScore: 8,
        latestSubmittedAt: new Date("2026-07-18T01:05:00.000Z"),
        exception: null,
        attempts: [],
      },
    ],
    questions: [
      {
        id: "question-1",
        position: 0,
        prompt: '=HYPERLINK("https://bad.example")',
        points: 10,
        answeredCount: 1,
        correctCount: 1,
        correctRate: 100,
      },
    ],
  };
}
