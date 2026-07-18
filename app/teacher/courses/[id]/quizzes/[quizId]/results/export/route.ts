import { audit } from "@/lib/audit/log";
import { assert } from "@/lib/auth/guards";
import { errorResponse } from "@/lib/errors";
import { getTeacherQuizResults } from "@/lib/quiz";
import { csvDownloadResponse } from "@/lib/report/csv";
import { buildTeacherQuizCsv } from "@/lib/report/teacher-quiz";
import { getRequestMeta } from "@/lib/utils/request";

type RouteContext = {
  params: Promise<{ id: string; quizId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id, quizId } = await context.params;

  try {
    const { session } = await assert.ownsCourse(id);
    const result = await getTeacherQuizResults({
      courseOfferingId: id,
      quizId,
      teacherId: session.user.id,
    });
    const body = buildTeacherQuizCsv(result);
    const meta = await getRequestMeta();

    await audit({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "CLASS_ANALYTICS_EXPORTED",
      targetType: "Quiz",
      targetId: quizId,
      targetLabel: result.title,
      after: {
        reportType: "teacher_quiz_analytics_csv",
        studentRowCount: result.students.length,
        questionRowCount: result.questions.length,
      },
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });

    return csvDownloadResponse({
      body,
      filename: `quiz-results-${quizId}.csv`,
      rowCount: result.students.length + result.questions.length,
    });
  } catch (error) {
    const response = errorResponse(error);
    return Response.json(response.body, { status: response.status });
  }
}
