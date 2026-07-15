import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SubmissionStatus } from "@prisma/client";
import { FileText } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { db } from "@/lib/db/client";
import { CourseShell } from "@/components/course/course-shell";
import { CreateAssignmentDialog } from "@/components/assignment/create-assignment-dialog";
import { AssignmentRowActions } from "@/components/assignment/assignment-row-actions";
import { teacherCourseTabs } from "../_tabs";

/**
 * Teacher Assignments tab — Phase 6 · P6-5a.
 *
 * Lists all Assignments of the CourseOffering ordered by createdAt DESC
 * (newest first — typical teacher mental model is "what did I just
 * post?"). Per-Assignment row shows:
 *   - title + due-date status (overdue / due soon / open / no deadline)
 *   - scored badge when isScored=true + linked ScoreItem.publishedAt
 *   - submission counts (submitted / late / returned / graded)
 *   - link to /assignments/[id] detail page
 *
 * Dialog (Pattern 7 native `<dialog>`) handles create with the ADR-0019
 * atomic ScoreItem coupling. Field-class A weight % → basis-point
 * conversion happens at the action edge (mirrors Phase 5).
 */

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AssignmentsListPage({ params }: PageProps) {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;
  const course = await getCourseOfferingForTeacher(id, session.user.id);
  if (!course) notFound();

  // Server component — captured once per request. React 19 purity lint
  // doesn't distinguish server from client; suppress for this single read.
  // eslint-disable-next-line react-hooks/purity
  const renderNow = Date.now();

  const assignments = await db.assignment.findMany({
    where: { courseOfferingId: id },
    select: {
      id: true,
      title: true,
      description: true,
      dueAt: true,
      allowText: true,
      allowFile: true,
      allowLink: true,
      isScored: true,
      submissionClosed: true,
      autoCloseAtDue: true,
      createdAt: true,
      scoreItem: { select: { publishedAt: true } },
      _count: { select: { submissions: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const pendingGroups =
    assignments.length > 0
      ? await db.submission.groupBy({
          by: ["assignmentId"],
          where: {
            assignmentId: { in: assignments.map((a) => a.id) },
            status: {
              in: [SubmissionStatus.SUBMITTED, SubmissionStatus.LATE_SUBMITTED],
            },
          },
          _count: { _all: true },
        })
      : [];
  const pendingCountByAssignment = new Map(
    pendingGroups.map((g) => [g.assignmentId, g._count._all])
  );
  const totalPendingReview = pendingGroups.reduce(
    (sum, g) => sum + g._count._all,
    0
  );

  return (
    <CourseShell
      session={session}
      course={course}
      eyebrow="รายวิชาที่สอน"
      backHref="/teacher/courses"
      tabs={teacherCourseTabs(id)}
    >
      <div className="card p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              className="text-lg font-medium text-black"
              style={{ letterSpacing: "-0.02em" }}
            >
              การบ้าน
            </h2>
            <p className="mt-0.5 text-xs text-black/50">
              {assignments.length === 0
                ? "ยังไม่มีการบ้าน"
                : `${assignments.length} รายการ`}
            </p>
          </div>
          {totalPendingReview > 0 && (
            <Link
              href={`/teacher/courses/${id}/assignments/${pendingGroups[0]?.assignmentId}?filter=pending`}
              className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-3 py-1.5 text-xs font-semibold text-orange-700 ring-1 ring-orange-500/15 transition hover:bg-orange-500/15 hover:no-underline"
            >
              รอตรวจทั้งหมด {totalPendingReview} ชิ้น
              <span aria-hidden="true">→</span>
            </Link>
          )}
          <CreateAssignmentDialog courseId={id} />
        </div>

        {assignments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/15 p-8 text-center">
            <FileText className="mx-auto h-7 w-7 text-black/30" />
            <p className="mt-3 text-sm text-black/60">
              ยังไม่มีการบ้านในวิชานี้
            </p>
            <p className="mt-1 text-xs text-black/40">
              กด &quot;เพิ่มการบ้าน&quot; เพื่อสร้างรายการแรก
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-black/5">
            {assignments.map((a) => {
              const pendingReview = pendingCountByAssignment.get(a.id) ?? 0;
              const dueLabel = a.dueAt
                ? new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
                    timeZone: "Asia/Bangkok",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(a.dueAt)
                : "ส่งเมื่อพร้อม";
              const isOverdue =
                a.dueAt !== null && a.dueAt.getTime() < renderNow;
              const publishedScoreItem =
                a.isScored && a.scoreItem?.publishedAt !== null;
              return (
                <li
                  key={a.id}
                  className="flex items-start justify-between gap-3 py-3 transition-colors hover:bg-black/[0.02]"
                >
                  <Link
                    href={`/teacher/courses/${id}/assignments/${a.id}`}
                    className="min-w-0 flex-1"
                  >
                    <div className="min-w-0 px-2">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-black">
                          {a.title}
                        </p>
                        {a.isScored && (
                          <span className="badge-info">นับคะแนน</span>
                        )}
                        {publishedScoreItem && (
                          <span className="rounded-md bg-green-500 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm ring-1 ring-black/10">
                            เผยแพร่
                          </span>
                        )}
                        {pendingReview > 0 && (
                          <span className="rounded-md bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 ring-1 ring-orange-500/15">
                            รอตรวจ {pendingReview}
                          </span>
                        )}
                        {a.submissionClosed && (
                          <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                            ปิดการส่ง
                          </span>
                        )}
                      </div>
                      <p
                        className={`mt-0.5 text-xs ${isOverdue ? "text-red-700" : "text-black/50"}`}
                      >
                        กำหนดส่ง: {dueLabel}
                        {a.autoCloseAtDue && a.dueAt && (
                          <span className="ml-2 text-[10px] text-black/40">
                            (ปิดอัตโนมัติ)
                          </span>
                        )}
                      </p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2">
                    {pendingReview > 0 && (
                      <Link
                        href={`/teacher/courses/${id}/assignments/${a.id}?filter=pending`}
                        className="self-center rounded-full bg-orange-500/10 px-2.5 py-1 text-xs font-semibold text-orange-700 ring-1 ring-orange-500/15 transition hover:bg-orange-500/15 hover:no-underline"
                      >
                        ไปตรวจ
                      </Link>
                    )}
                    <span className="self-center px-2 text-xs text-black/40">
                      {a._count.submissions} ส่งแล้ว →
                    </span>
                    <AssignmentRowActions courseId={id} assignment={a} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </CourseShell>
  );
}
