import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CalendarClock,
  ClipboardCheck,
  FileText,
  LockKeyhole,
  Users,
} from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import {
  getAdminLessonDetail,
  lessonWorkspaceCourseEnabled,
} from "@/lib/lesson";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string; lessonId: string }> };

export default async function AdminLessonDetailPage({ params }: PageProps) {
  let session;
  try {
    session = await requireRole(["ADMIN"]);
  } catch {
    redirect("/dashboard");
  }

  const { id, lessonId } = await params;
  if (!lessonWorkspaceCourseEnabled(id)) notFound();

  const lesson = await getAdminLessonDetail({
    courseOfferingId: id,
    lessonId,
    viewer: { id: session.user.id, role: session.user.role },
  });

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/courses/${id}/lessons`}
        className="btn-ghost btn-sm w-fit"
      >
        <ArrowLeft className="h-4 w-4" /> กลับไปภาพรวมบทเรียน
      </Link>

      <header className="rounded-lg border border-hairline bg-surface p-5 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-blue-700">
              รายละเอียดบทเรียน
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-ink">
              {lesson.title}
            </h2>
            <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-ink-mute">
              {lesson.description || "ยังไม่มีคำอธิบายสำหรับบทเรียนนี้"}
            </p>
          </div>
          <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-hairline bg-bg/60 px-3 py-1.5 text-xs font-medium text-ink-mute">
            <LockKeyhole className="h-3.5 w-3.5" /> อ่านอย่างเดียว
          </span>
        </div>
        <div className="mt-5 grid gap-3 border-t border-hairline pt-5 sm:grid-cols-3">
          <DetailMetric
            icon={Users}
            label="นักเรียนที่กำลังเรียน"
            value={`${lesson.activeStudentCount} คน`}
          />
          <DetailMetric
            icon={FileText}
            label="รายการในบท"
            value={`${lesson.assignments.length + lesson.materials.length} รายการ`}
          />
          <DetailMetric
            icon={ClipboardCheck}
            label="งานที่รอตรวจ"
            value={`${lesson.pendingGradingCount} ชิ้น`}
            warning={lesson.pendingGradingCount > 0}
          />
        </div>
      </header>

      <section
        aria-labelledby="admin-lesson-assignments"
        className="rounded-lg border border-hairline bg-surface p-5 shadow-card"
      >
        <h3
          id="admin-lesson-assignments"
          className="flex items-center gap-2 text-lg font-semibold text-ink"
        >
          <ClipboardCheck className="h-5 w-5 text-blue-700" /> งานในบทเรียน
        </h3>
        {lesson.assignments.length === 0 ? (
          <EmptyState icon={ClipboardCheck} text="ยังไม่มีงานในบทเรียนนี้" />
        ) : (
          <div className="mt-4 divide-y divide-hairline border-y border-hairline">
            {lesson.assignments.map((assignment) => (
              <article
                key={assignment.id}
                className="py-5 first:pt-4 last:pb-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <h4 className="font-semibold text-ink">
                      {assignment.title}
                    </h4>
                    {assignment.description && (
                      <p className="mt-1 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-ink-mute">
                        {assignment.description}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-mute">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {formatDueDate(assignment.dueAt)}
                      </span>
                      <span>
                        {assignment.isScored && assignment.fullScore !== null
                          ? `คะแนนเต็ม ${assignment.fullScore}`
                          : "ไม่นับคะแนน"}
                      </span>
                    </div>
                  </div>
                  <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
                    <CompactMetric
                      label="ส่งแล้ว"
                      value={assignment.submittedCount}
                    />
                    <CompactMetric
                      label="ยังไม่ส่ง"
                      value={assignment.missingCount}
                    />
                    <CompactMetric
                      label="ส่งสาย"
                      value={assignment.lateCount}
                    />
                    <CompactMetric
                      label="รอตรวจ"
                      value={assignment.pendingGradingCount}
                      warning={assignment.pendingGradingCount > 0}
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section
        aria-labelledby="admin-lesson-materials"
        className="rounded-lg border border-hairline bg-surface p-5 shadow-card"
      >
        <h3
          id="admin-lesson-materials"
          className="flex items-center gap-2 text-lg font-semibold text-ink"
        >
          <BookOpen className="h-5 w-5 text-blue-700" /> เอกสารและเนื้อหา
        </h3>
        {lesson.materials.length === 0 ? (
          <EmptyState icon={FileText} text="ยังไม่มีเอกสารในบทเรียนนี้" />
        ) : (
          <div className="mt-4 divide-y divide-hairline border-y border-hairline">
            {lesson.materials.map((material) => (
              <article key={material.id} className="py-5 first:pt-4 last:pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="font-semibold text-ink">{material.title}</h4>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink-mute">
                      {material.body || "ไม่มีรายละเอียดเพิ่มเติม"}
                    </p>
                  </div>
                  <time
                    className="shrink-0 text-xs text-ink-mute"
                    dateTime={material.postedAt.toISOString()}
                  >
                    {material.postedAt.toLocaleDateString("th-TH", {
                      dateStyle: "medium",
                    })}
                  </time>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DetailMetric({
  icon: Icon,
  label,
  value,
  warning = false,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-bg/60 p-4">
      <Icon
        className={`h-5 w-5 ${warning ? "text-orange-700" : "text-blue-700"}`}
      />
      <div>
        <p className="text-xs text-ink-mute">{label}</p>
        <p className="mt-0.5 font-semibold text-ink">{value}</p>
      </div>
    </div>
  );
}

function CompactMetric({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <div className="min-w-20 rounded-lg border border-hairline bg-bg/60 px-3 py-2 text-center">
      <strong
        className={`block text-base ${warning ? "text-orange-700" : "text-ink"}`}
      >
        {value}
      </strong>
      <span className="text-[11px] text-ink-mute">{label}</span>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  text,
}: {
  icon: typeof FileText;
  text: string;
}) {
  return (
    <div className="mt-4 rounded-lg border border-dashed border-hairline px-4 py-8 text-center text-sm text-ink-mute">
      <Icon className="mx-auto mb-2 h-5 w-5" /> {text}
    </div>
  );
}

function formatDueDate(value: Date | null): string {
  if (!value) return "ไม่กำหนดวันส่ง";
  return `ส่งภายใน ${value.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}`;
}
