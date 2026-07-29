import Papa from "papaparse";
import { z } from "zod";

const MAX_CSV_BYTES = 1_000_000;
const MAX_INVITES = 500;

const EmailSchema = z.string().trim().toLowerCase().email().max(254);

export type TeacherInviteCsvRow = {
  row: number;
  email: string;
};

export class TeacherInviteCsvError extends Error {
  constructor(
    message: string,
    public readonly detail?: string
  ) {
    super(message);
    this.name = "TeacherInviteCsvError";
  }
}

export function parseTeacherInviteCsv(csvText: string): TeacherInviteCsvRow[] {
  if (new TextEncoder().encode(csvText).byteLength > MAX_CSV_BYTES) {
    throw new TeacherInviteCsvError(
      "ไฟล์มีขนาดใหญ่เกินไป",
      "รองรับไฟล์ CSV ขนาดไม่เกิน 1 MB"
    );
  }

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  const parseErrors = parsed.errors.filter(
    (error) => error.code !== "UndetectableDelimiter"
  );
  if (parseErrors.length > 0) {
    throw new TeacherInviteCsvError(
      "อ่านไฟล์ CSV ไม่สำเร็จ",
      parseErrors.map((error) => error.message).join("; ")
    );
  }

  if (!(parsed.meta.fields ?? []).includes("email")) {
    throw new TeacherInviteCsvError(
      "ไม่พบคอลัมน์ email",
      "แถวแรกของไฟล์ต้องมีหัวคอลัมน์ email"
    );
  }

  if (parsed.data.length === 0) {
    throw new TeacherInviteCsvError("ไฟล์ CSV ไม่มีรายชื่อครู");
  }
  if (parsed.data.length > MAX_INVITES) {
    throw new TeacherInviteCsvError(
      "จำนวนรายชื่อมากเกินไป",
      `รองรับครั้งละไม่เกิน ${MAX_INVITES} อีเมล`
    );
  }

  const seen = new Set<string>();
  const rows: TeacherInviteCsvRow[] = [];
  const invalidRows: number[] = [];

  parsed.data.forEach((raw, index) => {
    const result = EmailSchema.safeParse(raw.email);
    const row = index + 2;
    if (!result.success) {
      invalidRows.push(row);
      return;
    }

    if (seen.has(result.data)) return;
    seen.add(result.data);
    rows.push({ row, email: result.data });
  });

  if (invalidRows.length > 0) {
    throw new TeacherInviteCsvError(
      "พบอีเมลไม่ถูกต้องในไฟล์",
      `ตรวจสอบแถว ${invalidRows.join(", ")}`
    );
  }
  if (rows.length === 0) {
    throw new TeacherInviteCsvError("ไฟล์ CSV ไม่มีอีเมลที่ใช้งานได้");
  }

  return rows;
}
