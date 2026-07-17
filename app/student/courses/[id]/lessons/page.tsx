import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Archive, ArrowRight } from "lucide-react";
import { CourseShell } from "@/components/course/course-shell";
import { StudentLearningPath } from "@/components/lesson/student-learning-path";
import { assert } from "@/lib/auth/guards";
import { getCourseOfferingForStudent } from "@/lib/course/queries";
import {
  getStudentLessonWorkspace,
  lessonWorkspaceCourseEnabled,
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
        <header className="grid gap-4 border-b border-hairline pb-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
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

          <StudentLearningPath courseId={id} lessons={active} />
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
