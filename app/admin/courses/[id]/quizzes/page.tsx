import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Eye,
  Users,
} from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import {
  getAdminQuizWorkspace,
  quizCourseEnabled,
  type AdminQuizObserverItem,
} from "@/lib/quiz";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminQuizzesPage({ params }: PageProps) {
  let session;
  try {
    session = await requireRole(["ADMIN"]);
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;
  if (!quizCourseEnabled(id)) notFound();
  const workspace = await getAdminQuizWorkspace({
    courseOfferingId: id,
    viewer: { id: session.user.id, role: session.user.role },
  });
  const openCount = workspace.quizzes.filter(
    (quiz) => quiz.status === "OPEN"
  ).length;
  const submittedCount = workspace.quizzes.reduce(
    (total, quiz) => total + quiz.counts.submitted,
    0
  );

  return (
    <div className="space-y-6">
      <header className="grid gap-4 rounded-lg border border-hairline bg-surface p-5 shadow-card md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <p className="text-sm font-medium text-blue-700">Quiz Observer</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">
            ภาพรวมแบบทดสอบในรายวิชา
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-mute">
            แสดงสถานะและสถิติรวมเพื่อกำกับดูแลระบบเท่านั้น ไม่มีรายชื่อ คำตอบ
            คะแนนรายคน หรือไฟล์ส่วนตัวของนักเรียน
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-hairline bg-bg/60 px-3 py-1.5 text-xs font-medium text-ink-mute">
          <Eye className="h-3.5 w-3.5" /> อ่านอย่างเดียว
        </span>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryMetric
          icon={ClipboardList}
          label="แบบทดสอบทั้งหมด"
          value={`${workspace.quizzes.length} รายการ`}
        />
        <SummaryMetric
          icon={CheckCircle2}
          label="กำลังเปิดรับ"
          value={`${openCount} รายการ`}
        />
        <SummaryMetric
          icon={Users}
          label="นักเรียนในรายวิชา"
          value={`${workspace.activeStudentCount} คน`}
        />
        <SummaryMetric
          icon={BarChart3}
          label="ผลที่ส่งแล้วรวม"
          value={`${submittedCount} รายการ`}
        />
      </section>

      <section aria-labelledby="admin-quiz-list">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 id="admin-quiz-list" className="font-semibold text-ink">
            แบบทดสอบทั้งหมด
          </h3>
          <span className="text-xs text-ink-mute">
            {workspace.quizzes.length} รายการ
          </span>
        </div>
        {workspace.quizzes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-hairline bg-surface px-6 py-12 text-center">
            <ClipboardList className="mx-auto h-8 w-8 text-ink-mute" />
            <p className="mt-3 text-sm text-ink-mute">
              ยังไม่มีแบบทดสอบในรายวิชานี้
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {workspace.quizzes.map((quiz) => (
              <QuizCard key={quiz.id} courseId={id} quiz={quiz} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function QuizCard({
  courseId,
  quiz,
}: {
  courseId: string;
  quiz: AdminQuizObserverItem;
}) {
  return (
    <Link
      href={`/admin/courses/${courseId}/quizzes/${quiz.id}`}
      className="group rounded-lg border border-hairline bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:border-blue-500/30 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-blue-700">
              {quiz.lessonTitle}
            </span>
            <QuizStatus
              status={quiz.status}
              published={quiz.publishedAt !== null}
            />
          </div>
          <h4 className="mt-2 truncate font-semibold text-ink">{quiz.title}</h4>
          <p className="mt-1 text-sm text-ink-mute">
            {quiz.mode === "SCORED" ? "แบบเก็บคะแนน" : "แบบฝึกทำ"} ·{" "}
            {quiz.questionCount} ข้อ · {quiz.totalPoints} คะแนน
          </p>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 text-blue-700 transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-hairline pt-4 text-center">
        <MiniMetric label="ส่งแล้ว" value={quiz.counts.submitted} />
        <MiniMetric label="กำลังทำ" value={quiz.counts.inProgress} />
        <MiniMetric
          label="เฉลี่ย"
          value={quiz.metrics.average === null ? "–" : quiz.metrics.average}
        />
      </div>
    </Link>
  );
}

function SummaryMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-surface p-4">
      <Icon className="h-4 w-4 text-blue-700" />
      <p className="mt-3 text-xs text-ink-mute">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <strong className="block text-base text-ink">{value}</strong>
      <span className="text-xs text-ink-mute">{label}</span>
    </div>
  );
}

function QuizStatus({
  status,
  published,
}: {
  status: AdminQuizObserverItem["status"];
  published: boolean;
}) {
  if (published)
    return <span className="badge badge-success">เผยแพร่แล้ว</span>;
  if (status === "OPEN")
    return <span className="badge badge-info">กำลังเปิด</span>;
  if (status === "CLOSED")
    return <span className="badge badge-warn">ปิดแล้ว</span>;
  return <span className="badge">ฉบับร่าง</span>;
}
