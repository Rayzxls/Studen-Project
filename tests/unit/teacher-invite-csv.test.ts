import { describe, expect, it } from "vitest";

import {
  parseTeacherInviteCsv,
  TeacherInviteCsvError,
} from "@/lib/identity/teacher-invite-csv";

describe("parseTeacherInviteCsv", () => {
  it("normalizes emails, ignores legacy name columns, and deduplicates", () => {
    expect(
      parseTeacherInviteCsv(
        [
          "email,firstName,lastName",
          " Teacher.One@Example.COM ,Teacher,One",
          "teacher.two@example.com,Teacher,Two",
          "teacher.one@example.com,Duplicate,Teacher",
        ].join("\n")
      )
    ).toEqual([
      { row: 2, email: "teacher.one@example.com" },
      { row: 3, email: "teacher.two@example.com" },
    ]);
  });

  it("requires the email header", () => {
    expect(() => parseTeacherInviteCsv("name\nTeacher One")).toThrowError(
      TeacherInviteCsvError
    );
  });

  it("reports invalid row numbers without issuing a partial batch", () => {
    expect(() =>
      parseTeacherInviteCsv(
        ["email", "valid@example.com", "not-an-email"].join("\n")
      )
    ).toThrowError(/อีเมลไม่ถูกต้อง/);

    try {
      parseTeacherInviteCsv(
        ["email", "valid@example.com", "not-an-email"].join("\n")
      );
    } catch (error) {
      expect(error).toMatchObject({ detail: "ตรวจสอบแถว 3" });
    }
  });
});
