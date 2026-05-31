import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Prisma client used by csv-import.ts (it queries User for duplicates)
vi.mock("@/lib/db/client", () => {
  return {
    db: {
      user: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
  };
});

import { parseTeacherCsv, CsvFormatError } from "@/lib/admin/csv-import";
import { db } from "@/lib/db/client";

const mockFindMany = db.user.findMany as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFindMany.mockReset();
  mockFindMany.mockResolvedValue([]);
});

describe("parseTeacherCsv", () => {
  it("parses a valid CSV", async () => {
    const csv = `email,firstName,lastName
somchai@school.local,สมชาย,ใจดี
sompong@school.local,สมพงษ์,ขยัน`;
    const r = await parseTeacherCsv(csv);
    expect(r.summary.total).toBe(2);
    expect(r.summary.valid).toBe(2);
    expect(r.summary.invalid).toBe(0);
    expect(r.rows[0].parsed?.email).toBe("somchai@school.local");
    expect(r.rows[0].parsed?.firstName).toBe("สมชาย");
  });

  it("rejects CSV missing required columns", async () => {
    const csv = `email,firstName
a@b.c,xxx`;
    await expect(parseTeacherCsv(csv)).rejects.toBeInstanceOf(CsvFormatError);
  });

  it("rejects empty CSV", async () => {
    const csv = `email,firstName,lastName`;
    await expect(parseTeacherCsv(csv)).rejects.toBeInstanceOf(CsvFormatError);
  });

  it("flags invalid email", async () => {
    const csv = `email,firstName,lastName
not-an-email,Foo,Bar
ok@school.local,OK,Person`;
    const r = await parseTeacherCsv(csv);
    expect(r.summary.invalid).toBe(1);
    expect(r.summary.valid).toBe(1);
    expect(r.rows[0].errors?.[0]).toMatch(/email|อีเมล/i);
  });

  it("flags missing firstName/lastName", async () => {
    const csv = `email,firstName,lastName
a@b.c,,Last
c@d.e,First,`;
    const r = await parseTeacherCsv(csv);
    expect(r.summary.invalid).toBe(2);
    expect(r.rows[0].errors?.length).toBeGreaterThan(0);
  });

  it("detects duplicate email within CSV", async () => {
    const csv = `email,firstName,lastName
dup@school.local,A,One
dup@school.local,A,Two`;
    const r = await parseTeacherCsv(csv);
    expect(r.summary.valid).toBe(1);
    expect(r.summary.duplicateInCsv).toBe(1);
  });

  it("detects duplicate email in DB", async () => {
    mockFindMany.mockResolvedValue([{ identifier: "existing@school.local" }]);
    const csv = `email,firstName,lastName
existing@school.local,A,One
new@school.local,B,Two`;
    const r = await parseTeacherCsv(csv);
    expect(r.summary.duplicateInDb).toBe(1);
    expect(r.summary.valid).toBe(1);
  });

  it("normalises email to lowercase", async () => {
    const csv = `email,firstName,lastName
MiXeD@School.LOCAL,A,B`;
    const r = await parseTeacherCsv(csv);
    expect(r.rows[0].parsed?.email).toBe("mixed@school.local");
  });

  it("skips empty rows", async () => {
    const csv = `email,firstName,lastName
a@school.local,A,B

c@school.local,C,D
`;
    const r = await parseTeacherCsv(csv);
    expect(r.summary.total).toBe(2);
    expect(r.summary.valid).toBe(2);
  });

  it("rejects file over 5 MB", async () => {
    const bigCsv = "email,firstName,lastName\n" + "x".repeat(5_500_000);
    await expect(parseTeacherCsv(bigCsv)).rejects.toBeInstanceOf(
      CsvFormatError
    );
  });
});
