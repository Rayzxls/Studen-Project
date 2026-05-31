import Papa from "papaparse";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit/log";
import { generateTempPassword } from "./temp-password";

/**
 * Teacher CSV Import
 *
 * Expected CSV format (UTF-8, headers required):
 *   email,firstName,lastName
 *   somchai@school.local,สมชาย,ใจดี
 *
 * Flow:
 *   1. parseTeacherCsv(text) → preview rows with row-level validation
 *   2. Admin reviews preview client-side
 *   3. commitTeachers(validRows, importerId) → creates User + Teacher in transaction
 *      + audit: USER_CREATED_BY_ADMIN × N, CSV_IMPORT summary
 *      + returns { email, tempPassword } per created teacher (for distribution)
 */

const TeacherRowSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: "อีเมลไม่ถูกต้อง" })
    .max(254),
  firstName: z.string().trim().min(1, { message: "ขาดชื่อ" }).max(100),
  lastName: z.string().trim().min(1, { message: "ขาดนามสกุล" }).max(100),
});

export type TeacherCsvRow = z.infer<typeof TeacherRowSchema>;

export interface PreviewRow {
  row: number; // 1-indexed line in CSV (excluding header)
  raw: Record<string, string>;
  parsed?: TeacherCsvRow;
  errors?: string[];
}

export interface PreviewResult {
  rows: PreviewRow[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    duplicateInCsv: number;
    duplicateInDb: number;
  };
}

const REQUIRED_COLUMNS = ["email", "firstName", "lastName"] as const;

export class CsvFormatError extends Error {
  constructor(
    message: string,
    public detail?: string
  ) {
    super(message);
    this.name = "CsvFormatError";
  }
}

export async function parseTeacherCsv(csvText: string): Promise<PreviewResult> {
  if (csvText.length > 5_000_000) {
    throw new CsvFormatError(
      "ไฟล์ใหญ่เกินไป (เกิน 5 MB)",
      "max 5MB / 5000 rows"
    );
  }

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0) {
    throw new CsvFormatError(
      "อ่านไฟล์ CSV ไม่ได้",
      parsed.errors.map((e) => e.message).join("; ")
    );
  }

  const fields = parsed.meta.fields ?? [];
  const missing = REQUIRED_COLUMNS.filter((c) => !fields.includes(c));
  if (missing.length > 0) {
    throw new CsvFormatError(
      `ขาด column ที่ต้องการ: ${missing.join(", ")}`,
      `Header ต้องมี: ${REQUIRED_COLUMNS.join(", ")}`
    );
  }

  if (parsed.data.length === 0) {
    throw new CsvFormatError("CSV ว่างเปล่า");
  }
  if (parsed.data.length > 5000) {
    throw new CsvFormatError("เกิน 5000 แถวต่อไฟล์");
  }

  const seenEmails = new Set<string>();
  const result: PreviewResult = {
    rows: [],
    summary: {
      total: parsed.data.length,
      valid: 0,
      invalid: 0,
      duplicateInCsv: 0,
      duplicateInDb: 0,
    },
  };

  for (let i = 0; i < parsed.data.length; i++) {
    const raw = parsed.data[i];
    const row = i + 2; // +1 for header line, +1 for 1-indexing
    const errors: string[] = [];

    const safe = TeacherRowSchema.safeParse(raw);
    if (!safe.success) {
      for (const issue of safe.error.issues) {
        errors.push(`${issue.path.join(".")}: ${issue.message}`);
      }
      result.rows.push({ row, raw, errors });
      result.summary.invalid++;
      continue;
    }

    const email = safe.data.email;
    if (seenEmails.has(email)) {
      result.rows.push({
        row,
        raw,
        errors: [`อีเมลซ้ำในไฟล์ CSV: ${email}`],
      });
      result.summary.duplicateInCsv++;
      continue;
    }
    seenEmails.add(email);

    result.rows.push({ row, raw, parsed: safe.data });
  }

  // Batch-check DB for existing emails
  const candidateEmails = result.rows
    .filter((r) => r.parsed)
    .map((r) => r.parsed!.email);

  if (candidateEmails.length > 0) {
    const existing = await db.user.findMany({
      where: { identifier: { in: candidateEmails } },
      select: { identifier: true },
    });
    const existingSet = new Set(existing.map((e) => e.identifier));

    for (const r of result.rows) {
      if (r.parsed && existingSet.has(r.parsed.email)) {
        r.errors = [`มีบัญชีนี้แล้วในระบบ: ${r.parsed.email}`];
        delete r.parsed;
        result.summary.duplicateInDb++;
      }
    }
  }

  result.summary.valid = result.rows.filter((r) => r.parsed).length;
  return result;
}

export interface CommitResult {
  created: Array<{
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    tempPassword: string;
  }>;
}

export async function commitTeachers(
  rows: TeacherCsvRow[],
  importerId: string,
  meta: { ipAddress?: string; userAgent?: string }
): Promise<CommitResult> {
  // Re-validate (defense in depth — client-sent rows could be tampered)
  const validRows: TeacherCsvRow[] = [];
  for (const r of rows) {
    const safe = TeacherRowSchema.safeParse(r);
    if (safe.success) validRows.push(safe.data);
  }

  // Generate temp passwords + hash
  const prepared = await Promise.all(
    validRows.map(async (r) => {
      const tempPassword = generateTempPassword();
      const hash = await hashPassword(tempPassword);
      return { ...r, tempPassword, hash };
    })
  );

  const created: CommitResult["created"] = [];

  await db.$transaction(async (tx) => {
    for (const p of prepared) {
      let user;
      try {
        user = await tx.user.create({
          data: {
            role: "TEACHER",
            identifier: p.email,
            passwordHash: p.hash,
            mustResetPwd: true,
            teacher: {
              create: {
                firstName: p.firstName,
                lastName: p.lastName,
                email: p.email,
              },
            },
          },
          select: { id: true },
        });
      } catch (err) {
        // Skip race-condition duplicates silently — the audit row at end will reflect actual count
        const code = (err as { code?: string })?.code;
        if (code === "P2002") continue;
        throw err;
      }

      await audit(
        {
          actorId: importerId,
          actorRole: "ADMIN",
          action: "USER_CREATED_BY_ADMIN",
          targetType: "User",
          targetId: user.id,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          after: {
            email: p.email,
            firstName: p.firstName,
            lastName: p.lastName,
            role: "TEACHER",
          },
        },
        tx
      );

      created.push({
        userId: user.id,
        email: p.email,
        firstName: p.firstName,
        lastName: p.lastName,
        tempPassword: p.tempPassword,
      });
    }

    // One CSV_IMPORT summary entry
    await audit(
      {
        actorId: importerId,
        actorRole: "ADMIN",
        action: "CSV_IMPORT",
        targetType: "TeachersBatch",
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        after: { count: created.length },
      },
      tx
    );
  });

  return { created };
}

/** Helper for unit tests — type-check Prisma TransactionClient signature without DB */
export type _TxClient = Prisma.TransactionClient;
