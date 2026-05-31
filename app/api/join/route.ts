import { NextResponse } from "next/server";
import { enrollByClassCode } from "@/lib/course/enrollment";
import { requireRole } from "@/lib/auth/guards";
import { JoinSchema } from "@/lib/validation/course";
import { getRequestMeta } from "@/lib/utils/request";
import { errorResponse, ValidationError } from "@/lib/errors";

/**
 * POST /api/join
 * Body: { code: "MATH4A-A8K2X3" }
 * Returns: { courseOfferingId, subjectName, className, teacherName }
 */
export async function POST(req: Request) {
  try {
    const session = await requireRole(["STUDENT"]);
    const meta = await getRequestMeta();

    const parsed = JoinSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new ValidationError({ code: "กรุณากรอกรหัสห้องเรียน" });
    }

    const result = await enrollByClassCode({
      studentUserId: session.user.id,
      rawCode: parsed.data.code,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
