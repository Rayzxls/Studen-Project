import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  FileText,
  FolderInput,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { CourseShell } from "@/components/course/course-shell";
import { UnifiedComposer } from "@/components/feed/unified-composer";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import {
  getLessonWorkspaceForViewer,
  getTeacherLessonDetail,
  lessonWorkspaceEnabled,
  lessonWorkspaceMutationsEnabled,
} from "@/lib/lesson";
import { teacherCourseTabs } from "../../_tabs";
import {
  archiveLessonAction,
  deleteLessonAction,
  moveLessonContentAction,
  updateLessonAction,
} from "../actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string; lessonId: string }>;
  searchParams: Promise<{ notice?: string }>;
};

export default async function TeacherLessonDetailPage({
  params,
  searchParams,
}: PageProps) {
  if (!lessonWorkspaceEnabled()) notFound();
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }
  const { id, lessonId } = await params;
  const { notice } = await searchParams;
  const [course, lesson, workspace] = await Promise.all([
    getCourseOfferingForTeacher(id, session.user.id),
    getTeacherLessonDetail({
      courseOfferingId: id,
      lessonId,
      teacherId: session.user.id,
    }),
    getLessonWorkspaceForViewer({
      courseOfferingId: id,
      viewer: { id: session.user.id, role: session.user.role },
    }),
  ]);
  if (!course) notFound();

  const lessonOptions = workspace.lessons
    .filter((item) => item.state === "ACTIVE")
    .map((item) => ({ id: item.id, title: item.title }));
  const moveTargets = lessonOptions.filter((item) => item.id !== lesson.id);
  const canMutate =
    lessonWorkspaceMutationsEnabled() && lesson.state === "ACTIVE";
  const isEmpty =
    lesson.assignments.length === 0 && lesson.materials.length === 0;

  return (
    <CourseShell
      session={session}
      course={course}
      eyebrow="รายวิชาที่สอน"
      backHref="/teacher/courses"
      tabs={teacherCourseTabs(id)}
    >
      <div className="space-y-6">
        <Link
          href={`/teacher/courses/${id}/lessons`}
          className="btn-ghost btn-sm w-fit"
        >
          <ArrowLeft className="h-4 w-4" /> กลับไปทุกบทเรียน
        </Link>
        {notice && (
          <p
            className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
            role="status"
          >
            {notice}
          </p>
        )}

        <header className="rounded-lg border border-hairline bg-surface p-6 shadow-card">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                <BookOpen className="h-4 w-4" /> บทเรียนลำดับ{" "}
                {lesson.position + 1}
                {lesson.state === "ARCHIVED" && (
                  <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-xs text-ink-mute">
                    เก็บในคลังแล้ว
                  </span>
                )}
              </div>
              <h2 className="mt-2 text-3xl font-semibold text-ink">
                {lesson.title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-mute">
                {lesson.description || `ยังไม่มีคำอธิบายของ ${lesson.title}`}
              </p>
            </div>
            {canMutate && (
              <UnifiedComposer
                courseId={id}
                lessonOptions={lessonOptions}
                defaultLessonId={lesson.id}
                requireLesson
              />
            )}
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Stat
              icon={Users}
              label="นักเรียนในห้อง"
              value={`${lesson.activeStudentCount} คน`}
            />
            <Stat
              icon={ClipboardList}
              label="การบ้านในบท"
              value={`${lesson.assignments.length} ชิ้น`}
            />
            <Stat
              icon={ClipboardCheck}
              label="งานรอตรวจ"
              value={`${lesson.pendingGradingCount} ชิ้น`}
              tone={lesson.pendingGradingCount > 0 ? "warning" : "default"}
            />
          </div>
        </header>

        {lesson.openAssignmentCount > 0 && (
          <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              มีการบ้านเปิดรับส่ง {lesson.openAssignmentCount} ชิ้น
              บทเรียนนี้จะเก็บเข้าคลังได้หลังปิดรับส่งและตรวจงานค้างให้เสร็จ
            </p>
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
          <div className="space-y-6">
            <ContentSection
              title="การบ้าน"
              icon={ClipboardList}
              empty={`ยังไม่มีการบ้านของ ${lesson.title}`}
            >
              {lesson.assignments.map((assignment) => (
                <article
                  key={assignment.id}
                  id={`assignment-${assignment.id}`}
                  className="scroll-mt-28 border-b border-hairline py-4 last:border-0 target:rounded-lg target:outline target:outline-2 target:outline-offset-4 target:outline-blue-500"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <Link
                        href={`/teacher/courses/${id}/assignments/${assignment.id}`}
                        className="font-semibold text-ink hover:text-blue-700"
                      >
                        {assignment.title}
                      </Link>
                      <p className="mt-1 text-xs text-ink-mute">
                        {assignment.dueAt
                          ? `ส่งภายใน ${assignment.dueAt.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}`
                          : "ไม่กำหนดวันส่ง"}
                        {assignment.fullScore !== null
                          ? ` · ${assignment.fullScore} คะแนน`
                          : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
                        ส่งแล้ว {assignment.submittedCount}/
                        {lesson.activeStudentCount}
                      </span>
                      <span className="rounded-full border border-hairline bg-surface px-2.5 py-1 text-ink-mute">
                        ยังไม่ส่ง {assignment.missingCount}
                      </span>
                      {assignment.pendingGradingCount > 0 && (
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">
                          รอตรวจ {assignment.pendingGradingCount}
                        </span>
                      )}
                      {assignment.lateCount > 0 && (
                        <span className="rounded-full bg-orange-50 px-2.5 py-1 text-orange-800">
                          ส่งสาย {assignment.lateCount}
                        </span>
                      )}
                    </div>
                  </div>
                  {canMutate && moveTargets.length > 0 && (
                    <MoveContentForm
                      courseId={id}
                      lessonId={lesson.id}
                      contentType="ASSIGNMENT"
                      contentId={assignment.id}
                      targets={moveTargets}
                    />
                  )}
                </article>
              ))}
            </ContentSection>

            <ContentSection
              title="เอกสารและสื่อ"
              icon={FileText}
              empty={`ยังไม่มีเอกสารของ ${lesson.title}`}
            >
              {lesson.materials.map((material) => (
                <article
                  key={material.id}
                  id={`material-${material.id}`}
                  className="scroll-mt-28 border-b border-hairline py-4 last:border-0 target:rounded-lg target:outline target:outline-2 target:outline-offset-4 target:outline-blue-500"
                >
                  <Link
                    href={`/teacher/courses/${id}/materials/${material.id}`}
                    className="font-semibold text-ink hover:text-blue-700"
                  >
                    {material.title}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-mute">
                    {material.body || "ไม่มีคำอธิบายเพิ่มเติม"}
                  </p>
                  {canMutate && moveTargets.length > 0 && (
                    <MoveContentForm
                      courseId={id}
                      lessonId={lesson.id}
                      contentType="MATERIAL"
                      contentId={material.id}
                      targets={moveTargets}
                    />
                  )}
                </article>
              ))}
            </ContentSection>

            <ContentSection
              title="ประกาศ"
              icon={AlertCircle}
              empty={`ยังไม่มีประกาศเฉพาะของ ${lesson.title}`}
            >
              <p className="py-4 text-sm text-ink-mute">
                ประกาศยังเป็นข้อมูลระดับทั้งห้องและแสดงตามเวลาในฟีด
                เพื่อไม่ให้นักเรียนพลาดข้อความสำคัญ
              </p>
            </ContentSection>
          </div>

          <aside className="space-y-4">
            {canMutate && (
              <details className="rounded-lg border border-hairline bg-surface p-5 shadow-card">
                <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-ink">
                  <Pencil className="h-4 w-4 text-blue-700" />{" "}
                  แก้รายละเอียดบทเรียน
                </summary>
                <form action={updateLessonAction} className="mt-4 space-y-3">
                  <input type="hidden" name="courseId" value={id} />
                  <input type="hidden" name="lessonId" value={lesson.id} />
                  <label className="block text-xs font-medium text-ink">
                    ชื่อบทเรียน
                    <input
                      name="title"
                      required
                      maxLength={120}
                      defaultValue={lesson.title}
                      className="input mt-1.5"
                    />
                  </label>
                  <label className="block text-xs font-medium text-ink">
                    คำอธิบาย
                    <textarea
                      name="description"
                      maxLength={1000}
                      defaultValue={lesson.description ?? ""}
                      rows={4}
                      className="input mt-1.5"
                    />
                  </label>
                  <button type="submit" className="btn-primary btn-sm w-full">
                    บันทึก
                  </button>
                </form>
              </details>
            )}

            {canMutate && (
              <details className="rounded-lg border border-hairline bg-surface p-5 shadow-card">
                <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-ink">
                  <Archive className="h-4 w-4" /> เก็บเข้าคลัง
                </summary>
                <p className="mt-3 text-xs leading-5 text-ink-mute">
                  ใช้เมื่อสอนบทนี้จบแล้ว
                  ระบบจะป้องกันหากยังมีงานเปิดหรือค้างตรวจ
                </p>
                <form action={archiveLessonAction} className="mt-3 space-y-3">
                  <input type="hidden" name="courseId" value={id} />
                  <input type="hidden" name="lessonId" value={lesson.id} />
                  <textarea
                    name="reason"
                    required
                    minLength={5}
                    maxLength={500}
                    rows={3}
                    className="input"
                    placeholder="เหตุผลสำหรับ Audit Log"
                  />
                  <button type="submit" className="btn-secondary btn-sm w-full">
                    <Archive className="h-4 w-4" /> เก็บบทเรียน
                  </button>
                </form>
              </details>
            )}

            {canMutate && isEmpty && (
              <details className="rounded-lg border border-red-200 bg-surface p-5 shadow-card">
                <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-red-700">
                  <Trash2 className="h-4 w-4" /> ลบบทเรียนว่าง
                </summary>
                <form action={deleteLessonAction} className="mt-3 space-y-3">
                  <input type="hidden" name="courseId" value={id} />
                  <input type="hidden" name="lessonId" value={lesson.id} />
                  <textarea
                    name="reason"
                    required
                    minLength={5}
                    maxLength={500}
                    rows={3}
                    className="input"
                    placeholder="เหตุผลสำหรับ Audit Log"
                  />
                  <button type="submit" className="btn-danger btn-sm w-full">
                    ยืนยันการลบ
                  </button>
                </form>
              </details>
            )}
          </aside>
        </section>
      </div>
    </CourseShell>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof Users;
  label: string;
  value: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-black/[0.025] p-4">
      <Icon
        className={`h-5 w-5 ${tone === "warning" ? "text-amber-600" : "text-blue-700"}`}
      />
      <div>
        <p className="text-xs text-ink-mute">{label}</p>
        <p className="mt-0.5 font-semibold text-ink">{value}</p>
      </div>
    </div>
  );
}

function ContentSection({
  title,
  icon: Icon,
  empty,
  children,
}: {
  title: string;
  icon: typeof FileText;
  empty: string;
  children: React.ReactNode;
}) {
  const isEmpty = Array.isArray(children) && children.length === 0;
  return (
    <section className="rounded-lg border border-hairline bg-surface p-5 shadow-card">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-ink">
        <Icon className="h-5 w-5 text-blue-700" /> {title}
      </h3>
      {isEmpty ? (
        <div className="mt-4 rounded-lg border border-dashed border-hairline px-4 py-8 text-center text-sm text-ink-mute">
          {empty}
        </div>
      ) : (
        <div className="mt-2">{children}</div>
      )}
    </section>
  );
}

function MoveContentForm({
  courseId,
  lessonId,
  contentType,
  contentId,
  targets,
}: {
  courseId: string;
  lessonId: string;
  contentType: "ASSIGNMENT" | "MATERIAL";
  contentId: string;
  targets: Array<{ id: string; title: string }>;
}) {
  return (
    <details className="mt-3">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-blue-700">
        <FolderInput className="h-3.5 w-3.5" /> ย้ายไปบทเรียนอื่น
      </summary>
      <form
        action={moveLessonContentAction}
        className="mt-3 grid gap-2 rounded-lg bg-black/[0.025] p-3 sm:grid-cols-[1fr_1fr_auto]"
      >
        <input type="hidden" name="courseId" value={courseId} />
        <input type="hidden" name="currentLessonId" value={lessonId} />
        <input type="hidden" name="contentType" value={contentType} />
        <input type="hidden" name="contentId" value={contentId} />
        <select name="targetLessonId" required className="input">
          <option value="">เลือกบทเรียนปลายทาง</option>
          {targets.map((target) => (
            <option key={target.id} value={target.id}>
              {target.title}
            </option>
          ))}
        </select>
        <input
          name="reason"
          required
          minLength={5}
          maxLength={500}
          className="input"
          placeholder="เหตุผลการย้าย"
        />
        <button type="submit" className="btn-secondary btn-sm">
          ย้าย
        </button>
      </form>
    </details>
  );
}
