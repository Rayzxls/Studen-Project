import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/auth/rate-limit";
import { parseTeacherCsv, CsvFormatError } from "@/lib/admin/csv-import";
import { errorResponse, TooManyRequests, ValidationError } from "@/lib/errors";

export async function POST(req: Request) {
  try {
    const session = await requireRole(["ADMIN"]);

    const limit = await rateLimit({
      key: `csv-preview:${session.user.id}`,
      max: 5,
      windowSec: 300,
      lockoutSec: 300,
    });
    if (!limit.allowed) {
      throw new TooManyRequests("csv_preview_rate_limit");
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new ValidationError({ file: "กรุณาเลือกไฟล์" });
    }
    if (file.size > 5_000_000) {
      throw new ValidationError({ file: "ไฟล์ใหญ่เกิน 5 MB" });
    }
    const text = await file.text();

    try {
      const result = await parseTeacherCsv(text);
      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof CsvFormatError) {
        return NextResponse.json(
          {
            error: {
              code: "csv_format_error",
              message: err.message,
              detail: err.detail,
            },
          },
          { status: 400 }
        );
      }
      throw err;
    }
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
