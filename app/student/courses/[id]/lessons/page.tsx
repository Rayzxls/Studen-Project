import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Archive,
  ArrowRight,
  BookOpen,
  Check,
  Circle,
  ClipboardList,
  Clock3,
  FileText,
} from "lucide-react";
import { CourseShell } from "@/components/course/course-shell";
import { assert } from "@/lib/auth/guards";
import { getCourseOfferingForStudent } from "@/lib/course/queries";
import {
  getStudentLessonWorkspace,
  lessonWorkspaceCourseEnabled,
  type StudentLessonItem,
} from "@/lib/lesson";
import { studentCourseTabs } from "../_tabs";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function StudentLessonsPage({ params }: PageProps) {
  const { id } = await params;
  if (!lessonWorkspaceCourseEnabled(id)) notFound();

  let guard;
  try {
    guard = await assert.isActiveCourseMember(id);
  } catch {
    redirect("/dashboard");
  }

  const [course, workspace] = await Promise.all([
    getCourseOfferingForStudent(id, guard.session.user.id),
    getStudentLessonWorkspace({
      courseOfferingId: id,
      studentId: guard.session.user.id,
    }),
  ]);
  if (!course) notFound();

  const active = workspace.lessons.filter(
    (lesson) => lesson.state === "ACTIVE"
  );
  const archived = workspace.lessons.filter(
    (lesson) => lesson.state === "ARCHIVED"
  );
  const totalAssignments = active.reduce(
    (sum, lesson) => sum + lesson.assignmentCount,
    0
  );
  const completedAssignments = active.reduce(
    (sum, lesson) => sum + lesson.completedAssignmentCount,
    0
  );

  return (
    <CourseShell
      session={guard.session}
      course={course}
      eyebrow="ห้องเรียน"
      backHref="/dashboard"
      tabs={studentCourseTabs(id)}
    >
      <div className="space-y-7 pb-8">
        <header className="grid gap-4 rounded-lg border border-hairline bg-surface p-5 shadow-card md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <p className="text-sm font-medium text-blue-700">
              เส้นทางการเรียนของฉัน
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-ink">
              เห็นทุกบท รู้ว่างานถัดไปคืออะไร
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-ink-mute">
              ทุกบทเรียนเปิดดูได้เสมอ
              ความคืบหน้าคำนวณจากการบ้านที่ส่งแล้วเท่านั้น
            </p>
          </div>
          <div className="flex gap-3 text-sm">
            <SummaryMetric value={active.length} label="บทเรียน" />
            <SummaryMetric
              value={`${completedAssignments}/${totalAssignments}`}
              label="งานที่ส่ง"
            />
          </div>
        </header>

        <section aria-labelledby="learning-path-title">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 id="learning-path-title" className="font-semibold text-ink">
              บทเรียนปัจจุบัน
            </h3>
            <span className="text-xs text-ink-mute">ไม่มีการล็อกลำดับ</span>
          </div>

          {active.length === 0 ? (
            <div className="rounded-lg border border-dashed border-hairline bg-surface px-6 py-12 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-ink-mute" />
              <p className="mt-3 font-medium text-ink">ยังไม่มีบทเรียน</p>
              <p className="mt-1 text-sm text-ink-mute">
                เมื่อครูสร้างบทเรียน รายการจะปรากฏที่นี่ทันที
              </p>
            </div>
          ) : (
            <div className="relative space-y-4 pl-10 before:absolute before:bottom-8 before:left-[19px] before:top-8 before:w-px before:bg-hairline">
              {active.map((lesson, index) => (
                <LessonPathCard
                  key={lesson.id}
                  courseId={id}
                  lesson={lesson}
                  index={index}
                />
              ))}
            </div>
          )}
        </section>

        {archived.length > 0 && (
          <details className="rounded-lg border border-hairline bg-surface shadow-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
              <span className="inline-flex items-center gap-2 font-semibold text-ink">
                <Archive className="h-4 w-4" /> บทเรียนที่จบแล้ว
              </span>
              <span className="text-xs text-ink-mute">
                {archived.length} บทเรียน
              </span>
            </summary>
            <div className="divide-y divide-hairline border-t border-hairline">
              {archived.map((lesson) => (
                <Link
                  key={lesson.id}
                  href={`/student/courses/${id}/lessons/${lesson.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-black/[0.025]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">
                      {lesson.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-mute">
                      ส่งแล้ว {lesson.completedAssignmentCount}/
                      {lesson.assignmentCount} งาน
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-mute" />
                </Link>
              ))}
            </div>
          </details>
        )}
      </div>
    </CourseShell>
  );
}

function LessonPathCard({
  courseId,
  lesson,
  index,
}: {
  courseId: string;
  lesson: StudentLessonItem;
  index: number;
}) {
  const checkpoints = [
    ...lesson.materials.map((material) => ({
      id: material.id,
      label: material.title,
      kind: "material" as const,
      complete: false,
      overdue: false,
    })),
    ...lesson.assignments.map((assignment) => ({
      id: assignment.id,
      label: assignment.title,
      kind: "assignment" as const,
      complete: assignment.isCompleted,
      overdue: assignment.isOverdue,
    })),
  ];

  return (
    <article className="relative">
      <span
        className={`absolute -left-10 top-6 z-10 flex h-10 w-10 items-center justify-center rounded-full border-4 border-bg shadow-sm ${lesson.progressPercent === 100 && lesson.assignmentCount > 0 ? "bg-green-500 text-white" : lesson.progressPercent > 0 ? "bg-blue-500 text-white" : "bg-surface text-ink-mute ring-1 ring-hairline"}`}
        aria-hidden="true"
      >
        {lesson.progressPercent === 100 && lesson.assignmentCount > 0 ? (
          <Check className="h-4 w-4" />
        ) : (
          <span className="text-xs font-semibold">
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
      </span>
      <Link
        href={`/student/courses/${courseId}/lessons/${lesson.id}`}
        className="group grid gap-4 rounded-lg border border-hairline bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:border-blue-500/40 hover:shadow-lg md:grid-cols-[minmax(0,1fr)_220px] md:items-center"
      >
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="truncate text-lg font-semibold text-ink">
                {lesson.title}
              </h4>
              <p className="mt-1 line-clamp-2 text-sm text-ink-mute">
                {lesson.description || `ยังไม่มีคำอธิบายของ ${lesson.title}`}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-blue-700 transition-transform group-hover:translate-x-0.5" />
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-mute">
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" /> {lesson.materialCount} เอกสาร
            </span>
            <span className="inline-flex items-center gap-1">
              <ClipboardList className="h-3.5 w-3.5" /> {lesson.assignmentCount}{" "}
              งาน
            </span>
          </div>
          {checkpoints.length > 0 && (
            <div className="mt-4 border-t border-hairline pt-4">
              <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                {checkpoints.slice(0, 3).map((checkpoint) => (
                  <span
                    key={`${checkpoint.kind}-${checkpoint.id}`}
                    className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-xs text-ink-mute"
                  >
                    {checkpoint.complete ? (
                      <Check className="h-4 w-4 shrink-0 text-green-600" />
                    ) : checkpoint.overdue ? (
                      <Clock3 className="h-4 w-4 shrink-0 text-orange-700" />
                    ) : checkpoint.kind === "material" ? (
                      <FileText className="h-4 w-4 shrink-0 text-blue-700" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-ink-mute" />
                    )}
                    <span className="truncate">{checkpoint.label}</span>
                  </span>
                ))}
                {checkpoints.length > 3 && (
                  <span className="shrink-0 text-xs text-ink-mute">
                    +{checkpoints.length - 3}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="rounded-lg border border-hairline bg-bg/60 p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-mute">ความคืบหน้าของฉัน</span>
            <strong className="text-ink">{lesson.progressPercent}%</strong>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-hairline">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{ width: `${lesson.progressPercent}%` }}
            />
          </div>
          <p className="mt-3 truncate text-xs font-medium text-ink">
            {lesson.nextTask?.title ??
              (lesson.assignmentCount > 0
                ? "ส่งงานครบแล้ว"
                : "ยังไม่มีงานในบทนี้")}
          </p>
          <p
            className={`mt-1 text-[11px] ${lesson.nextTask?.isOverdue ? "text-orange-700" : "text-ink-mute"}`}
          >
            {formatNextDue(lesson)}
          </p>
        </div>
      </Link>
    </article>
  );
}

function SummaryMetric({
  value,
  label,
}: {
  value: number | string;
  label: string;
}) {
  return (
    <div className="min-w-24 rounded-lg border border-hairline bg-bg/60 px-4 py-3 text-center">
      <strong className="block text-lg text-ink">{value}</strong>
      <span className="text-xs text-ink-mute">{label}</span>
    </div>
  );
}

function formatNextDue(lesson: StudentLessonItem): string {
  if (!lesson.nextTask) return "ไม่มีงานที่ต้องทำต่อ";
  if (!lesson.nextTask.dueAt) return "ไม่กำหนดวันส่ง";
  const date = lesson.nextTask.dueAt.toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return lesson.nextTask.isOverdue ? `เกินกำหนด ${date}` : `ส่งภายใน ${date}`;
}
