import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Download,
  LockKeyhole,
  RotateCcw,
  Send,
  ShieldCheck,
  Square,
  Users,
} from "lucide-react";
import type { TeacherQuizResultsView } from "@/lib/quiz";
import {
  closeQuizAction,
  publishQuizResultsAction,
  reopenQuizAction,
  setQuizStudentExceptionAction,
} from "@/app/teacher/courses/[id]/quizzes/actions";

type Props = {
  result: TeacherQuizResultsView;
  notice?: string;
  mutationsEnabled: boolean;
};

export function TeacherQuizResults({
  result,
  notice,
  mutationsEnabled,
}: Props) {
  const missingCount = result.counts.notStarted;
  const reopenDefault = result.closesAt
    ? toBangkokDateTimeLocal(new Date(result.closesAt.getTime() + 86_400_000))
    : "";

  return (
    <div className="space-y-5 pb-12">
      {notice && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
          {notice}
        </div>
      )}

      <header className="rounded-lg border border-hairline bg-surface p-5 shadow-card md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-blue-700">
                {result.lessonTitle}
              </span>
              <QuizStatusBadge result={result} />
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-ink md:text-3xl">
              {result.title}
            </h1>
            <p className="mt-2 text-sm text-ink-mute">
              {result.mode === "SCORED" ? "แบบเก็บคะแนน" : "แบบฝึกทำ"} ·{" "}
              {result.totalPoints} คะแนน
              {result.closesAt
                ? ` · ปิด ${formatDateTime(result.closesAt)}`
                : ""}
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <a
              href={`/teacher/courses/${result.courseOfferingId}/quizzes/${result.id}/results/export`}
              className="btn-secondary btn-sm w-full"
            >
              <Download className="h-4 w-4" /> ดาวน์โหลด CSV
            </a>
            {mutationsEnabled && (
              <>
                {result.status === "OPEN" && (
                  <form action={closeQuizAction}>
                    <HiddenIds result={result} />
                    <button
                      className="btn-secondary btn-sm w-full"
                      type="submit"
                    >
                      <Square className="h-4 w-4" /> ปิดรับคำตอบ
                    </button>
                  </form>
                )}
                {result.status === "CLOSED" && result.publishedAt === null && (
                  <details className="relative">
                    <summary className="btn-secondary btn-sm w-full cursor-pointer list-none">
                      <RotateCcw className="h-4 w-4" /> เปิดอีกครั้ง
                    </summary>
                    <form
                      action={reopenQuizAction}
                      className="mt-2 w-full space-y-3 rounded-lg border border-hairline bg-surface p-4 shadow-card sm:absolute sm:right-0 sm:z-20 sm:w-80"
                    >
                      <HiddenIds result={result} />
                      <label className="block text-xs font-medium text-ink">
                        เวลาปิดใหม่
                        <input
                          className="input mt-1.5 text-sm"
                          type="datetime-local"
                          name="newClosesAt"
                          defaultValue={reopenDefault}
                          required
                        />
                      </label>
                      <label className="block text-xs font-medium text-ink">
                        เหตุผล
                        <textarea
                          className="input mt-1.5 min-h-20 resize-y text-sm"
                          name="reason"
                          minLength={5}
                          maxLength={500}
                          required
                        />
                      </label>
                      <button
                        className="btn-primary btn-sm w-full"
                        type="submit"
                      >
                        <RotateCcw className="h-4 w-4" /> ยืนยันเปิดอีกครั้ง
                      </button>
                    </form>
                  </details>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Users}
          label="นักเรียนทั้งหมด"
          value={`${result.counts.total} คน`}
        />
        <Metric
          icon={CheckCircle2}
          label="ส่งแล้ว"
          value={`${result.counts.submitted} คน`}
          tone="success"
        />
        <Metric
          icon={Clock3}
          label="กำลังทำ"
          value={`${result.counts.inProgress} คน`}
          tone="info"
        />
        <Metric
          icon={BarChart3}
          label="คะแนนเฉลี่ย"
          value={scoreText(result.metrics.average, result.totalPoints)}
        />
      </section>

      {result.mode === "SCORED" && result.status === "CLOSED" && (
        <section className="rounded-lg border border-hairline bg-surface p-5 shadow-card">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                {result.publishedAt ? (
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                ) : (
                  <LockKeyhole className="h-5 w-5 text-orange-600" />
                )}
                <h2 className="font-semibold text-ink">
                  {result.publishedAt
                    ? "เผยแพร่ผลแล้ว"
                    : "ผลยังเป็นส่วนตัวของครู"}
                </h2>
              </div>
              <p className="mt-1 text-sm text-ink-mute">
                {result.publishedAt
                  ? `เผยแพร่เมื่อ ${formatDateTime(result.publishedAt)} และย้อนกลับไม่ได้`
                  : missingCount > 0
                    ? `มีนักเรียน ${missingCount} คนที่ไม่มี attempt ระบบจะนับเป็น 0 เมื่อเผยแพร่`
                    : "นักเรียนส่งครบแล้ว พร้อมเผยแพร่คะแนน"}
              </p>
            </div>
            {!result.publishedAt && mutationsEnabled && (
              <form action={publishQuizResultsAction} className="space-y-3">
                <HiddenIds result={result} />
                {missingCount > 0 && (
                  <label className="flex max-w-md items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-900">
                    <input
                      type="checkbox"
                      name="missingStudentsConfirmed"
                      className="mt-0.5 h-4 w-4"
                      required
                    />
                    ยืนยันให้นักเรียนที่ยังไม่ทำ {missingCount} คนเป็น 0 คะแนน
                  </label>
                )}
                <button className="btn-primary btn-sm w-full" type="submit">
                  <Send className="h-4 w-4" /> เผยแพร่ผลคะแนน
                </button>
              </form>
            )}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-hairline bg-surface shadow-card">
        <div className="border-b border-hairline px-5 py-4">
          <h2 className="font-semibold text-ink">ผลรายคน</h2>
          <p className="mt-1 text-sm text-ink-mute">
            คะแนนที่แสดงเป็น attempt ที่ดีที่สุดของนักเรียนแต่ละคน
          </p>
        </div>
        <div className="divide-y divide-hairline">
          {result.students.map((student) => (
            <article key={student.enrollmentId} className="p-4 md:p-5">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_120px_auto] md:items-center">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">
                    {student.name}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-mute">
                    {student.studentCode} · ทำ {student.attemptCount} ครั้ง
                  </p>
                </div>
                <StudentStatus status={student.status} />
                <div>
                  <p className="text-xs text-ink-mute">คะแนนดีที่สุด</p>
                  <p className="mt-0.5 font-semibold text-ink">
                    {scoreText(student.bestScore, result.totalPoints)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  {student.attempts.length > 0 && (
                    <details>
                      <summary className="btn-secondary btn-sm cursor-pointer list-none">
                        ประวัติ
                      </summary>
                      <div className="mt-2 min-w-64 rounded-lg border border-hairline bg-bg p-3 text-xs text-ink-soft">
                        {student.attempts.map((attempt) => (
                          <div
                            key={attempt.id}
                            className="flex justify-between gap-4 border-b border-hairline py-2 last:border-0"
                          >
                            <span>ครั้งที่ {attempt.attemptNumber}</span>
                            <span>
                              {attempt.status === "IN_PROGRESS"
                                ? "กำลังทำ"
                                : scoreText(
                                    attempt.finalScore,
                                    result.totalPoints
                                  )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  {mutationsEnabled && result.publishedAt === null && (
                    <ExceptionForm result={result} student={student} />
                  )}
                </div>
              </div>
              {student.exception && (
                <p className="mt-3 text-xs font-medium text-blue-700">
                  สิทธิ์พิเศษ:{" "}
                  {student.exception.extraAttempts > 0
                    ? `เพิ่ม ${student.exception.extraAttempts} ครั้ง`
                    : ""}
                  {student.exception.extendedDeadline
                    ? `${student.exception.extraAttempts > 0 ? " · " : ""}ถึง ${formatDateTime(student.exception.extendedDeadline)}`
                    : ""}
                </p>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-hairline bg-surface p-5 shadow-card">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold text-ink">วิเคราะห์รายข้อ</h2>
            <p className="mt-1 text-sm text-ink-mute">
              คำนวณจาก attempt ที่ดีที่สุดของผู้ส่งแต่ละคน
            </p>
          </div>
          <p className="text-sm text-ink-soft">
            สูงสุด {scoreText(result.metrics.highest, result.totalPoints)} ·
            ต่ำสุด {scoreText(result.metrics.lowest, result.totalPoints)}
          </p>
        </div>
        <div className="mt-5 space-y-4">
          {result.questions.map((question) => (
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
                ตอบ {question.answeredCount} คน · ถูก {question.correctCount} คน
                · {question.points} คะแนน
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function HiddenIds({ result }: { result: TeacherQuizResultsView }) {
  return (
    <>
      <input type="hidden" name="courseId" value={result.courseOfferingId} />
      <input type="hidden" name="lessonId" value={result.lessonId} />
      <input type="hidden" name="quizId" value={result.id} />
    </>
  );
}

function ExceptionForm({
  result,
  student,
}: {
  result: TeacherQuizResultsView;
  student: TeacherQuizResultsView["students"][number];
}) {
  return (
    <details className="relative">
      <summary className="btn-secondary btn-sm cursor-pointer list-none">
        ให้สิทธิ์พิเศษ
      </summary>
      <form
        action={setQuizStudentExceptionAction}
        className="mt-2 space-y-3 rounded-lg border border-hairline bg-surface p-4 shadow-card md:absolute md:right-0 md:z-20 md:w-80"
      >
        <HiddenIds result={result} />
        <input type="hidden" name="enrollmentId" value={student.enrollmentId} />
        <p className="text-sm font-semibold text-ink">{student.name}</p>
        <label className="block text-xs font-medium text-ink">
          ขยายเวลาถึง
          <input
            className="input mt-1.5 text-sm"
            type="datetime-local"
            name="extendedDeadline"
            defaultValue={
              student.exception?.extendedDeadline
                ? toBangkokDateTimeLocal(student.exception.extendedDeadline)
                : ""
            }
          />
        </label>
        {result.mode === "SCORED" && (
          <label className="block text-xs font-medium text-ink">
            เพิ่มจำนวนครั้ง
            <input
              className="input mt-1.5 text-sm"
              type="number"
              name="extraAttempts"
              min={0}
              max={9}
              defaultValue={student.exception?.extraAttempts ?? 0}
            />
          </label>
        )}
        <label className="block text-xs font-medium text-ink">
          เหตุผล
          <textarea
            className="input mt-1.5 min-h-20 resize-y text-sm"
            name="reason"
            minLength={5}
            maxLength={500}
            required
          />
        </label>
        <button className="btn-primary btn-sm w-full" type="submit">
          บันทึกสิทธิ์พิเศษ
        </button>
      </form>
    </details>
  );
}

function QuizStatusBadge({ result }: { result: TeacherQuizResultsView }) {
  if (result.publishedAt)
    return <span className="badge badge-success">เผยแพร่แล้ว</span>;
  return (
    <span
      className={`badge ${result.status === "OPEN" ? "badge-info" : "badge-warn"}`}
    >
      {result.status === "OPEN" ? "กำลังเปิดรับ" : "ปิดรับแล้ว"}
    </span>
  );
}

function StudentStatus({
  status,
}: {
  status: TeacherQuizResultsView["students"][number]["status"];
}) {
  const label =
    status === "SUBMITTED"
      ? "ส่งแล้ว"
      : status === "IN_PROGRESS"
        ? "กำลังทำ"
        : "ยังไม่เริ่ม";
  const tone =
    status === "SUBMITTED"
      ? "badge-success"
      : status === "IN_PROGRESS"
        ? "badge-info"
        : "badge-warn";
  return <span className={`badge w-fit ${tone}`}>{label}</span>;
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: typeof Users;
  label: string;
  value: string;
  tone?: "neutral" | "success" | "info";
}) {
  const color =
    tone === "success"
      ? "text-green-700"
      : tone === "info"
        ? "text-blue-700"
        : "text-ink";
  return (
    <div className="rounded-lg border border-hairline bg-surface p-4 shadow-card">
      <div className="flex items-center gap-2 text-xs font-medium text-ink-mute">
        <Icon className={`h-4 w-4 ${color}`} /> {label}
      </div>
      <p className={`mt-3 text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function scoreText(score: number | null, total: number) {
  return score === null ? "—" : `${score}/${total}`;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

function toBangkokDateTimeLocal(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Bangkok",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
