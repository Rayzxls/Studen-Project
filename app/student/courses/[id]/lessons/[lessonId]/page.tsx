import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleHelp,
  ClipboardList,
  Clock3,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { CourseShell } from "@/components/course/course-shell";
import { ReportContentButton } from "@/components/moderation/report-content-button";
import { assert } from "@/lib/auth/guards";
import { getCourseOfferingForStudent } from "@/lib/course/queries";
import {
  getStudentLessonWorkspace,
  lessonWorkspaceCourseEnabled,
  studentSubmissionStatusLabel,
  type StudentLessonAssignment,
} from "@/lib/lesson";
import { moderationCenterEnabled } from "@/lib/moderation/feature-flags";
import {
  getStudentQuizSummariesForLesson,
  quizCourseEnabled,
} from "@/lib/quiz";
import { studentCourseTabs } from "../../_tabs";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string; lessonId: string }>;
};

export default async function StudentLessonDetailPage({ params }: PageProps) {
  const { id, lessonId } = await params;
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
  const lesson = workspace.lessons.find((item) => item.id === lessonId);
  if (!lesson) notFound();
  const canReport = moderationCenterEnabled();
  const quizEnabled = quizCourseEnabled(id);
  const quizzes = quizEnabled
    ? await getStudentQuizSummariesForLesson({
        courseOfferingId: id,
        lessonId,
        studentId: guard.session.user.id,
      })
    : [];

  return (
    <CourseShell
      session={guard.session}
      course={course}
      eyebrow="ห้องเรียน"
      backHref="/dashboard"
      tabs={studentCourseTabs(id)}
    >
      <div className="space-y-6 pb-8">
        <Link
          href={`/student/courses/${id}/lessons`}
          className="inline-flex items-center gap-1.5 text-sm text-ink-mute hover:text-blue-700"
        >
          <ArrowLeft className="h-4 w-4" /> กลับไปทุกบทเรียน
        </Link>

        <header className="rounded-lg border border-hairline bg-surface p-6 shadow-card">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-blue-700">
                {lesson.state === "ARCHIVED"
                  ? "บทเรียนที่จบแล้ว"
                  : "เส้นทางบทเรียน"}
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-ink">
                {lesson.title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-ink-mute">
                {lesson.description || `ยังไม่มีคำอธิบายของ ${lesson.title}`}
              </p>
            </div>
            <div className="w-full rounded-lg border border-hairline bg-bg/60 p-4 md:w-64">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-mute">ความคืบหน้าของฉัน</span>
                <strong className="text-ink">{lesson.progressPercent}%</strong>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-hairline">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{ width: `${lesson.progressPercent}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-ink-mute">
                ส่งแล้ว {lesson.completedAssignmentCount}/
                {lesson.assignmentCount} งาน
              </p>
            </div>
          </div>
        </header>

        {lesson.nextTask && (
          <section
            className={`flex flex-col gap-4 rounded-lg border p-5 sm:flex-row sm:items-center sm:justify-between ${lesson.nextTask.isOverdue ? "border-orange-500/30 bg-orange-50" : "border-blue-500/20 bg-blue-50"}`}
          >
            <div className="flex items-start gap-3">
              <Clock3
                className={`mt-0.5 h-5 w-5 shrink-0 ${lesson.nextTask.isOverdue ? "text-orange-700" : "text-blue-700"}`}
              />
              <div>
                <p className="text-xs font-semibold text-ink-mute">
                  {lesson.nextTask.isOverdue
                    ? "งานที่เกินกำหนด"
                    : "ทำต่อจากตรงนี้"}
                </p>
                <h3 className="mt-1 font-semibold text-ink">
                  {lesson.nextTask.title}
                </h3>
                <p className="mt-1 text-xs text-ink-mute">
                  {formatDue(lesson.nextTask)}
                </p>
              </div>
            </div>
            <Link
              href={`/student/courses/${id}/assignments/${lesson.nextTask.id}`}
              className="btn-primary btn-sm shrink-0"
            >
              เปิดงาน <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        )}

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2 lg:items-start">
          <ContentSection
            icon={BookOpen}
            title="เอกสารและสื่อ"
            subtitle="เปิดอ่านได้ทุกเวลา และไม่ถูกนับเป็นการส่งงาน"
          >
            {lesson.materials.length === 0 ? (
              <EmptyState icon={FileText} text="ยังไม่มีเอกสารในบทเรียนนี้" />
            ) : (
              <div className="divide-y divide-hairline">
                {lesson.materials.map((material) => (
                  <div
                    key={material.id}
                    id={`material-${material.id}`}
                    className="group flex scroll-mt-28 items-center justify-between gap-3 py-4 first:pt-1 last:pb-1 target:rounded-lg target:outline target:outline-2 target:outline-offset-4 target:outline-blue-500"
                  >
                    <Link
                      href={`/student/courses/${id}/materials/${material.id}`}
                      className="flex min-w-0 flex-1 items-center gap-3 hover:no-underline"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                        <FileText className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">
                          {material.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-ink-mute">
                          พร้อมอ่าน
                        </span>
                      </span>
                    </Link>
                    <span className="flex shrink-0 items-center gap-1">
                      {canReport && (
                        <ReportContentButton
                          targetType="MATERIAL"
                          targetId={material.id}
                          compact
                        />
                      )}
                      <Link
                        href={`/student/courses/${id}/materials/${material.id}`}
                        className="icon-button h-8 w-8 text-ink-mute"
                        aria-label={`เปิดเอกสาร ${material.title}`}
                      >
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ContentSection>

          {quizEnabled && (
            <ContentSection
              icon={CircleHelp}
              title="แบบทดสอบ"
              subtitle="ทำแบบฝึกหัดและติดตามผลของบทนี้"
            >
              {quizzes.length === 0 ? (
                <EmptyState
                  icon={CircleHelp}
                  text={`ยังไม่มีแบบทดสอบใน ${lesson.title}`}
                />
              ) : (
                <div className="divide-y divide-hairline">
                  {quizzes.map((quiz) => (
                    <Link
                      key={quiz.id}
                      href={`/student/courses/${id}/quizzes/${quiz.id}`}
                      className="group flex items-center justify-between gap-3 py-4 first:pt-1 last:pb-1 hover:no-underline"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">
                          {quiz.title}
                        </span>
                        <span className="mt-1 block text-xs text-ink-mute">
                          {quiz.questionCount} ข้อ · {quiz.totalPoints} คะแนน
                          {quiz.mode === "PRACTICE"
                            ? " · แบบฝึกหัด"
                            : " · เก็บคะแนน"}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {quiz.activeAttemptId ? (
                          <span className="badge badge-info">กำลังทำ</span>
                        ) : quiz.scoreVisible && quiz.latestScore !== null ? (
                          <span className="badge badge-success">
                            {quiz.latestScore}/{quiz.totalPoints}
                          </span>
                        ) : quiz.status === "CLOSED" ? (
                          <span className="badge">ปิดแล้ว</span>
                        ) : (
                          <span className="badge badge-info">พร้อมทำ</span>
                        )}
                        <ArrowRight className="h-4 w-4 text-ink-mute transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </ContentSection>
          )}

          <ContentSection
            icon={ClipboardList}
            title="การบ้าน"
            subtitle="สถานะของคุณในบทเรียนนี้"
          >
            {lesson.assignments.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                text="ยังไม่มีการบ้านในบทเรียนนี้"
              />
            ) : (
              <div className="divide-y divide-hairline">
                {lesson.assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    id={`assignment-${assignment.id}`}
                    className="group flex scroll-mt-28 items-center justify-between gap-3 py-4 first:pt-1 last:pb-1 target:rounded-lg target:outline target:outline-2 target:outline-offset-4 target:outline-blue-500"
                  >
                    <Link
                      href={`/student/courses/${id}/assignments/${assignment.id}`}
                      className="min-w-0 flex-1 hover:no-underline"
                    >
                      <span className="block truncate font-medium text-ink">
                        {assignment.title}
                      </span>
                      <span className="mt-1 block text-xs text-ink-mute">
                        {formatDue(assignment)}
                      </span>
                    </Link>
                    <span className="flex shrink-0 items-center gap-2">
                      <StatusBadge assignment={assignment} />
                      {canReport && (
                        <ReportContentButton
                          targetType="ASSIGNMENT"
                          targetId={assignment.id}
                          compact
                        />
                      )}
                      <Link
                        href={`/student/courses/${id}/assignments/${assignment.id}`}
                        className="icon-button h-8 w-8 text-ink-mute"
                        aria-label={`เปิดการบ้าน ${assignment.title}`}
                      >
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ContentSection>
        </div>
      </div>
    </CourseShell>
  );
}

function ContentSection({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-hairline bg-surface p-5 shadow-card">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h3 className="font-semibold text-ink">{title}</h3>
          <p className="mt-0.5 text-xs text-ink-mute">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-hairline px-4 py-10 text-center">
      <Icon className="mx-auto h-6 w-6 text-ink-mute" />
      <p className="mt-2 text-sm text-ink-mute">{text}</p>
    </div>
  );
}

function StatusBadge({ assignment }: { assignment: StudentLessonAssignment }) {
  const className = assignment.isCompleted
    ? "bg-green-50 text-green-700"
    : assignment.isOverdue
      ? "bg-orange-50 text-orange-700"
      : assignment.status === "RETURNED"
        ? "bg-orange-50 text-orange-700"
        : "border border-hairline bg-surface text-ink-mute";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${className}`}
    >
      {assignment.isCompleted && <CheckCircle2 className="h-3.5 w-3.5" />}
      {assignment.isOverdue
        ? "เกินกำหนด"
        : studentSubmissionStatusLabel(assignment.status)}
    </span>
  );
}

function formatDue(assignment: StudentLessonAssignment): string {
  if (!assignment.dueAt) return "ไม่กำหนดวันส่ง";
  const date = assignment.dueAt.toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return assignment.isOverdue ? `เกินกำหนด ${date}` : `ส่งภายใน ${date}`;
}
