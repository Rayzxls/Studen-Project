import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Archive,
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  FileText,
  Users,
} from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import {
  getAdminLessonWorkspace,
  lessonWorkspaceCourseEnabled,
  type AdminLessonItem,
} from "@/lib/lesson";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminLessonsPage({ params }: PageProps) {
  let session;
  try {
    session = await requireRole(["ADMIN"]);
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;
  if (!lessonWorkspaceCourseEnabled(id)) notFound();

  const workspace = await getAdminLessonWorkspace({
    courseOfferingId: id,
    viewer: { id: session.user.id, role: session.user.role },
  });
  const active = workspace.lessons.filter(
    (lesson) => lesson.state === "ACTIVE"
  );
  const archived = workspace.lessons.filter(
    (lesson) => lesson.state === "ARCHIVED"
  );
  const totalAssignments = active.reduce(
    (total, lesson) => total + lesson.assignmentCount,
    0
  );
  const pendingGrading = active.reduce(
    (total, lesson) => total + lesson.pendingGradingCount,
    0
  );

  return (
    <div className="space-y-6">
      <header className="grid gap-4 rounded-lg border border-hairline bg-surface p-5 shadow-card md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <p className="text-sm font-medium text-blue-700">
            โครงสร้างการเรียนรู้
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">
            ภาพรวมบทเรียนในรายวิชา
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-mute">
            มุมมองสำหรับผู้ดูแลระบบ แสดงเนื้อหาและสถิติรวมเท่านั้น
            โดยไม่เปิดเผยงานส่วนตัว ไฟล์ส่งงาน หรือข้อมูลรายบุคคลของนักเรียน
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-hairline bg-bg/60 px-3 py-1.5 text-xs font-medium text-ink-mute">
          <BookOpen className="h-3.5 w-3.5" /> อ่านอย่างเดียว
        </span>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="สรุปบทเรียน">
        <SummaryMetric
          icon={Users}
          label="นักเรียนที่กำลังเรียน"
          value={`${workspace.activeStudentCount} คน`}
        />
        <SummaryMetric
          icon={FileText}
          label="งานในบทที่ใช้งาน"
          value={`${totalAssignments} งาน`}
        />
        <SummaryMetric
          icon={ClipboardCheck}
          label="งานที่รอตรวจ"
          value={`${pendingGrading} ชิ้น`}
          warning={pendingGrading > 0}
        />
      </section>

      <LessonList
        title="บทเรียนที่ใช้งาน"
        empty="ยังไม่มีบทเรียนในรายวิชานี้"
        lessons={active}
        courseId={id}
      />

      {archived.length > 0 && (
        <section aria-labelledby="admin-archived-lessons">
          <h3
            id="admin-archived-lessons"
            className="mb-3 flex items-center gap-2 font-semibold text-ink"
          >
            <Archive className="h-4 w-4" /> บทเรียนที่เก็บแล้ว (
            {archived.length})
          </h3>
          <div className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-surface">
            {archived.map((lesson) => (
              <Link
                key={lesson.id}
                href={`/admin/courses/${id}/lessons/${lesson.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-blue-500/[0.04]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">
                    {lesson.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-mute">
                    {lesson.assignmentCount} งาน · {lesson.materialCount} เอกสาร
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-ink-mute" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function LessonList({
  title,
  empty,
  lessons,
  courseId,
}: {
  title: string;
  empty: string;
  lessons: AdminLessonItem[];
  courseId: string;
}) {
  return (
    <section aria-labelledby="admin-active-lessons">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 id="admin-active-lessons" className="font-semibold text-ink">
          {title}
        </h3>
        <span className="text-xs text-ink-mute">{lessons.length} บทเรียน</span>
      </div>

      {lessons.length === 0 ? (
        <div className="rounded-lg border border-dashed border-hairline bg-surface px-6 py-12 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-ink-mute" />
          <p className="mt-3 text-sm text-ink-mute">{empty}</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {lessons.map((lesson, index) => (
            <Link
              key={lesson.id}
              href={`/admin/courses/${courseId}/lessons/${lesson.id}`}
              className="group rounded-lg border border-hairline bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:border-blue-500/30 hover:shadow-lg"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="truncate font-semibold text-ink">
                      {lesson.title}
                    </h4>
                    <ArrowRight className="h-4 w-4 shrink-0 text-blue-700 transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-ink-mute">
                    {lesson.description || "ยังไม่มีคำอธิบายสำหรับบทเรียนนี้"}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-hairline pt-4 text-center">
                <LessonMetric label="งาน" value={lesson.assignmentCount} />
                <LessonMetric label="เอกสาร" value={lesson.materialCount} />
                <LessonMetric
                  label="รอตรวจ"
                  value={lesson.pendingGradingCount}
                />
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-mute">
                    ส่งงานแล้วตามรายการทั้งหมด
                  </span>
                  <strong className="text-ink">
                    {lesson.completionPercent}%
                  </strong>
                </div>
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-hairline"
                  role="progressbar"
                  aria-label={`ความคืบหน้ารวมของ ${lesson.title}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={lesson.completionPercent}
                >
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${lesson.completionPercent}%` }}
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function SummaryMetric({
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
    <div className="rounded-lg border border-hairline bg-surface p-4">
      <Icon
        className={`h-4 w-4 ${warning ? "text-orange-700" : "text-blue-700"}`}
      />
      <p className="mt-3 text-xs text-ink-mute">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function LessonMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <strong className="block text-base text-ink">{value}</strong>
      <span className="text-xs text-ink-mute">{label}</span>
    </div>
  );
}
