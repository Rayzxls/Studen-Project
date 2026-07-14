import { audit } from "@/lib/audit/log";
import { assert } from "@/lib/auth/guards";
import { errorResponse } from "@/lib/errors";
import { csvDownloadResponse } from "@/lib/report/csv";
import { buildTeacherScoreCsv } from "@/lib/report/teacher-course";
import { getScoreboardForTeacher } from "@/lib/scoring/queries";
import { getRequestMeta } from "@/lib/utils/request";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const { session, course } = await assert.ownsCourse(id);
    const scoreboard = await getScoreboardForTeacher(id, session.user.id);
    const body = buildTeacherScoreCsv(scoreboard);
    const meta = await getRequestMeta();

    await audit({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "CLASS_ANALYTICS_EXPORTED",
      targetType: "CourseOffering",
      targetId: id,
      targetLabel: course.name,
      after: {
        reportType: "teacher_score_summary_csv",
        rowCount: scoreboard.rows.length,
        scoreItemCount: scoreboard.items.length,
      },
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });

    return csvDownloadResponse({
      body,
      filename: `course-scores-${id}.csv`,
      rowCount: scoreboard.rows.length,
    });
  } catch (error) {
    const response = errorResponse(error);
    return Response.json(response.body, { status: response.status });
  }
}
