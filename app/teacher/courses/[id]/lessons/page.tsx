import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Archive,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  ClipboardList,
  FileText,
  Plus,
} from "lucide-react";
import { CourseShell } from "@/components/course/course-shell";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import {
  getLessonWorkspaceForViewer,
  lessonWorkspaceCourseEnabled,
  lessonWorkspaceCourseMutationsEnabled,
} from "@/lib/lesson";
import { teacherCourseTabs } from "../_tabs";
import { createLessonAction, reorderLessonAction } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
};

export default async function TeacherLessonsPage({
  params,
  searchParams,
}: PageProps) {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }
  const { id } = await params;
  if (!lessonWorkspaceCourseEnabled(id)) notFound();
  const { notice } = await searchParams;
  const [course, workspace] = await Promise.all([
    getCourseOfferingForTeacher(id, session.user.id),
    getLessonWorkspaceForViewer({
      courseOfferingId: id,
      viewer: { id: session.user.id, role: session.user.role },
    }),
  ]);
  if (!course) notFound();

  const active = workspace.lessons.filter(
    (lesson) => lesson.state === "ACTIVE"
  );
  const archived = workspace.lessons.filter(
    (lesson) => lesson.state === "ARCHIVED"
  );
  const canMutate = lessonWorkspaceCourseMutationsEnabled(id);

  return (
    <CourseShell
      session={session}
      course={course}
      eyebrow="รายวิชาที่สอน"
      backHref="/teacher/courses"
      tabs={teacherCourseTabs(id)}
    >
      <div className="space-y-6">
        {notice && (
          <p
            className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
            role="status"
          >
            {notice}
          </p>
        )}

        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-700">
              พื้นที่จัดบทเรียน
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-ink">
              จัดเนื้อหาให้ค้นง่าย ตรวจงานได้ไว
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-ink-mute">
              ตั้งชื่อบทเรียนได้เอง
              แล้วรวมเอกสารและการบ้านที่เกี่ยวข้องไว้ด้วยกัน
              ฟีดเดิมยังเรียงตามเวลาเหมือนเดิม
            </p>
          </div>
          <span className="text-sm text-ink-mute">
            {active.length} บทเรียนที่ใช้งาน
          </span>
        </header>

        {canMutate ? (
          <form
            action={createLessonAction}
            className="rounded-lg border border-hairline bg-surface p-5 shadow-card"
          >
            <input type="hidden" name="courseId" value={id} />
            <div className="flex items-center gap-2 text-ink">
              <Plus className="h-5 w-5 text-blue-700" />
              <h3 className="font-semibold">สร้างบทเรียนใหม่</h3>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto]">
              <label className="text-sm font-medium text-ink">
                ชื่อบทเรียน
                <input
                  name="title"
                  required
                  maxLength={120}
                  className="input mt-1.5"
                  placeholder="เช่น การทักทายและแนะนำตัว"
                />
              </label>
              <label className="text-sm font-medium text-ink">
                คำอธิบาย{" "}
                <span className="font-normal text-ink-mute">(ไม่บังคับ)</span>
                <input
                  name="description"
                  maxLength={1000}
                  className="input mt-1.5"
                  placeholder="สิ่งที่นักเรียนจะได้เรียนในบทนี้"
                />
              </label>
              <button type="submit" className="btn-primary self-end">
                <Plus className="h-4 w-4" /> สร้างบทเรียน
              </button>
            </div>
          </form>
        ) : (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            โหมดอ่านอย่างเดียว การแก้ไขบทเรียนยังไม่เปิดใช้งานในสภาพแวดล้อมนี้
          </p>
        )}

        <section aria-labelledby="active-lessons-title">
          <div className="mb-3 flex items-center justify-between">
            <h3
              id="active-lessons-title"
              className="text-lg font-semibold text-ink"
            >
              บทเรียนปัจจุบัน
            </h3>
            <p className="text-xs text-ink-mute">เรียงตามเส้นทางการสอน</p>
          </div>
          {active.length === 0 ? (
            <div className="rounded-lg border border-dashed border-hairline bg-surface px-6 py-12 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-ink-mute" />
              <p className="mt-3 font-medium text-ink">ยังไม่มีบทเรียน</p>
              <p className="mt-1 text-sm text-ink-mute">
                ตั้งชื่อหัวข้อแรกได้ตามแผนการสอนของคุณ
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {active.map((lesson, index) => (
                <article
                  key={lesson.id}
                  className="rounded-lg border border-hairline bg-surface p-5 shadow-card"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-lg font-semibold text-ink">
                        {lesson.title}
                      </h4>
                      <p className="mt-1 line-clamp-2 text-sm text-ink-mute">
                        {lesson.description ||
                          `ยังไม่มีคำอธิบายของ ${lesson.title}`}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-mute">
                        <span className="inline-flex items-center gap-1">
                          <ClipboardList className="h-3.5 w-3.5" />{" "}
                          {lesson.assignmentCount} งาน
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5" />{" "}
                          {lesson.materialCount} เอกสาร
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canMutate && (
                        <>
                          <form action={reorderLessonAction}>
                            <input type="hidden" name="courseId" value={id} />
                            <input
                              type="hidden"
                              name="lessonId"
                              value={lesson.id}
                            />
                            <input type="hidden" name="direction" value="up" />
                            <button
                              type="submit"
                              className="btn-ghost btn-sm"
                              disabled={index === 0}
                              aria-label={`เลื่อน ${lesson.title} ขึ้น`}
                              title="เลื่อนขึ้น"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </button>
                          </form>
                          <form action={reorderLessonAction}>
                            <input type="hidden" name="courseId" value={id} />
                            <input
                              type="hidden"
                              name="lessonId"
                              value={lesson.id}
                            />
                            <input
                              type="hidden"
                              name="direction"
                              value="down"
                            />
                            <button
                              type="submit"
                              className="btn-ghost btn-sm"
                              disabled={index === active.length - 1}
                              aria-label={`เลื่อน ${lesson.title} ลง`}
                              title="เลื่อนลง"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </button>
                          </form>
                        </>
                      )}
                      <Link
                        href={`/teacher/courses/${id}/lessons/${lesson.id}`}
                        className="btn-secondary btn-sm"
                      >
                        เปิดบทเรียน <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {archived.length > 0 && (
          <section aria-labelledby="archived-lessons-title">
            <h3
              id="archived-lessons-title"
              className="mb-3 flex items-center gap-2 text-base font-semibold text-ink"
            >
              <Archive className="h-4 w-4" /> คลังบทเรียน ({archived.length})
            </h3>
            <div className="divide-y divide-hairline rounded-lg border border-hairline bg-surface">
              {archived.map((lesson) => (
                <Link
                  key={lesson.id}
                  href={`/teacher/courses/${id}/lessons/${lesson.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-black/[0.025]"
                >
                  <span className="truncate font-medium text-ink">
                    {lesson.title}
                  </span>
                  <span className="shrink-0 text-xs text-ink-mute">
                    {lesson.assignmentCount + lesson.materialCount} รายการ
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </CourseShell>
  );
}
