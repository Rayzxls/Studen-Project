import { describe, expect, it } from "vitest";
import { buildCsv } from "@/lib/report/csv";
import {
  buildTeacherAttendanceCsv,
  buildTeacherScoreCsv,
} from "@/lib/report/teacher-course";

describe("CSV safety", () => {
  it("adds a UTF-8 BOM, escapes quotes, and neutralizes formulas", () => {
    const csv = buildCsv(
      ["ชื่อ", "หมายเหตุ"],
      [['=HYPERLINK("https://bad.example")', "ข้อความ, มี comma"]]
    );

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('"ข้อความ, มี comma"');
    expect(csv).toContain('""https://bad.example""');
  });

  it("rejects rows whose column count does not match the header", () => {
    expect(() => buildCsv(["a"], [["a", "b"]])).toThrow(
      "csv_column_count_mismatch"
    );
  });
});

describe("Teacher score CSV", () => {
  it("exports item values and only published items in the running total", () => {
    const csv = buildTeacherScoreCsv({
      items: [
        {
          id: "published",
          name: "แบบฝึกหัด",
          fullScore: 10,
          position: 0,
          publishedAt: new Date("2026-07-14T00:00:00.000Z"),
        },
        {
          id: "draft",
          name: "สอบย่อย",
          fullScore: 5,
          position: 1,
          publishedAt: null,
        },
      ],
      rows: [
        {
          enrollmentId: "e1",
          studentUserId: "u1",
          studentId: "36901234",
          firstName: "ธนภัทร",
          lastName: "พิลาดี",
          removedAt: null,
          entries: [
            { scoreItemId: "published", value: 8, note: null },
            { scoreItemId: "draft", value: 4, note: null },
          ],
        },
      ],
    });

    expect(csv).toContain("แบบฝึกหัด (เผยแพร่แล้ว / 10)");
    expect(csv).toContain("สอบย่อย (ร่าง / 5)");
    expect(csv).toContain('"8","4","8","10","80.00",');
  });
});

describe("Teacher attendance CSV", () => {
  it("exports status counts, unmarked sessions, and attendance rate", () => {
    const csv = buildTeacherAttendanceCsv({
      totalSessions: 5,
      rows: [
        {
          enrollmentId: "e1",
          student: {
            studentId: "36901234",
            firstName: "ธนภัทร",
            lastName: "พิลาดี",
          },
          counts: { PRESENT: 2, LATE: 1, EXCUSED: 1, ABSENT: 0 },
        },
      ],
    });

    expect(csv).toContain('"2","1","1","0","1","4","5","75.00"');
  });
});
