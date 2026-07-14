import { audit } from "@/lib/audit/log";
import { assert } from "@/lib/auth/guards";
import { getAttendanceSummaryForTeacher } from "@/lib/attendance/queries";
import { errorResponse } from "@/lib/errors";
import { csvDownloadResponse } from "@/lib/report/csv";
import { buildTeacherAttendanceCsv } from "@/lib/report/teacher-course";
import { getRequestMeta } from "@/lib/utils/request";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const { session, course } = await assert.ownsCourse(id);
    const summary = await getAttendanceSummaryForTeacher(id, session.user.id);
    const body = buildTeacherAttendanceCsv(summary);
    const meta = await getRequestMeta();

    await audit({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "CLASS_ANALYTICS_EXPORTED",
      targetType: "CourseOffering",
      targetId: id,
      targetLabel: course.name,
      after: {
        reportType: "teacher_attendance_summary_csv",
        rowCount: summary.rows.length,
        sessionCount: summary.totalSessions,
      },
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });

    return csvDownloadResponse({
      body,
      filename: `course-attendance-${id}.csv`,
      rowCount: summary.rows.length,
    });
  } catch (error) {
    const response = errorResponse(error);
    return Response.json(response.body, { status: response.status });
  }
}
