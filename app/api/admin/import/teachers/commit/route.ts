import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/auth/rate-limit";
import { commitTeachers, type TeacherCsvRow } from "@/lib/admin/csv-import";
import { getRequestMeta } from "@/lib/utils/request";
import { errorResponse, TooManyRequests, ValidationError } from "@/lib/errors";

const BodySchema = z.object({
  rows: z
    .array(
      z.object({
        email: z.string().email().max(254),
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
      })
    )
    .min(1, "ไม่มีข้อมูลที่จะนำเข้า")
    .max(5000, "เกิน 5000 รายการ"),
});

export async function POST(req: Request) {
  try {
    const session = await requireRole(["ADMIN"]);
    const meta = await getRequestMeta();

    const limit = await rateLimit({
      key: `csv-commit:${session.user.id}`,
      max: 1,
      windowSec: 300,
      lockoutSec: 300,
    });
    if (!limit.allowed) {
      throw new TooManyRequests("csv_commit_rate_limit");
    }

    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errors[issue.path.join(".")] = issue.message;
      }
      throw new ValidationError(errors);
    }

    const rows: TeacherCsvRow[] = parsed.data.rows.map((r) => ({
      email: r.email.toLowerCase(),
      firstName: r.firstName.trim(),
      lastName: r.lastName.trim(),
    }));

    const result = await commitTeachers(rows, session.user.id, {
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
