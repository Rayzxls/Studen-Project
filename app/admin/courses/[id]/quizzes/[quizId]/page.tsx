import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock3,
  Eye,
  Users,
} from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getAdminQuizDetail, quizCourseEnabled } from "@/lib/quiz";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string; quizId: string }> };

export default async function AdminQuizDetailPage({ params }: PageProps) {
  let session;
  try {
    session = await requireRole(["ADMIN"]);
  } catch {
    redirect("/dashboard");
  }

  const { id, quizId } = await params;
  if (!quizCourseEnabled(id)) notFound();
  const quiz = await getAdminQuizDetail({
    courseOfferingId: id,
    quizId,
    viewer: { id: session.user.id, role: session.user.role },
  });

  return (
    <div className="space-y-5 pb-10">
      <Link
        href={`/admin/courses/${id}/quizzes`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-blue-700 hover:no-underline"
      >
        <ArrowLeft className="h-4 w-4" /> กลับไปแบบทดสอบทั้งหมด
      </Link>

      <header className="rounded-lg border border-hairline bg-surface p-5 shadow-card md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-700">
              {quiz.lessonTitle}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">
              {quiz.title}
            </h2>
            <p className="mt-2 text-sm text-ink-mute">
              {quiz.mode === "SCORED" ? "แบบเก็บคะแนน" : "แบบฝึกทำ"} ·{" "}
              {quiz.questionCount} ข้อ · {quiz.totalPoints} คะแนน
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-hairline bg-bg/60 px-3 py-1.5 text-xs font-medium text-ink-mute">
            <Eye className="h-3.5 w-3.5" /> ข้อมูลรวม · อ่านอย่างเดียว
          </span>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Users}
          label="นักเรียนทั้งหมด"
          value={`${quiz.counts.total} คน`}
        />
        <Metric
          icon={CheckCircle2}
          label="ส่งแล้ว"
          value={`${quiz.counts.submitted} คน`}
        />
        <Metric
          icon={Clock3}
          label="กำลังทำ"
          value={`${quiz.counts.inProgress} คน`}
        />
        <Metric
          icon={BarChart3}
          label="คะแนนเฉลี่ย"
          value={scoreText(quiz.metrics.average, quiz.totalPoints)}
        />
      </section>

      <section className="rounded-lg border border-hairline bg-surface p-5 shadow-card">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="font-semibold text-ink">วิเคราะห์รายข้อ</h3>
            <p className="mt-1 text-sm text-ink-mute">
              แสดงเฉพาะจำนวนและอัตราตอบถูกจาก attempt ที่ดีที่สุด
            </p>
          </div>
          <p className="text-sm text-ink-soft">
            สูงสุด {scoreText(quiz.metrics.highest, quiz.totalPoints)} · ต่ำสุด{" "}
            {scoreText(quiz.metrics.lowest, quiz.totalPoints)}
          </p>
        </div>
        {quiz.questions.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-hairline px-4 py-10 text-center text-sm text-ink-mute">
            แบบทดสอบนี้ยังไม่มีคำถาม
          </p>
        ) : (
          <div className="mt-5 space-y-5">
            {quiz.questions.map((question) => (
              <div key={question.id}>
                <div className="flex items-start justify-between gap-4 text-sm">
                  <p className="min-w-0 font-medium text-ink">
                    {question.position + 1}. {question.prompt}
                  </p>
                  <span className="shrink-0 text-ink-mute">
                    {question.correctRate === null
                      ? "ยังไม่มีคำตอบ"
                      : `ถูก ${question.correctRate}%`}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/[0.06]">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-[width] duration-500"
                    style={{ width: `${question.correctRate ?? 0}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-ink-mute">
                  ตอบ {question.answeredCount} คน · ถูก {question.correctCount}{" "}
                  คน · {question.points} คะแนน
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-surface p-4 shadow-card">
      <div className="flex items-center gap-2 text-xs font-medium text-ink-mute">
        <Icon className="h-4 w-4 text-blue-700" /> {label}
      </div>
      <p className="mt-3 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function scoreText(score: number | null, total: number) {
  return score === null ? "–" : `${score}/${total}`;
}
