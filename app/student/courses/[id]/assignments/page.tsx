import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { CourseShell } from "@/components/course/course-shell";
import { studentCourseTabs } from "../_tabs";

/**
 * Student Assignments tab — Phase 6 · P6-6.
 *
 * Lists Assignments the student can see (active enrollment) of the given
 * CourseOffering, ordered by createdAt DESC. Per-Assignment row shows:
 *   - title + scored badge
 *   - own Submission.status badge (NOT_SUBMITTED sentinel when no row)
 *   - due-date status (overdue tinted rose)
 *
 * The L1 boundary: a student NEVER sees other students' submissions or
 * counts. Only own Submission row joins.
 */

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  NOT_SUBMITTED: { label: "ยังไม่ส่ง", color: "bg-black/[0.05] text-black/60" },
  DRAFT: { label: "ร่าง", color: "bg-black/[0.05] text-black/60" },
  SUBMITTED: { label: "ส่งแล้ว", color: "bg-emerald-50 text-emerald-700" },
  LATE_SUBMITTED: { label: "ส่งสาย", color: "bg-amber-50 text-amber-700" },
  RETURNED: { label: "ส่งคืน", color: "bg-rose-50 text-rose-700" },
  GRADED: { label: "ตรวจแล้ว", color: "bg-blue-50 text-blue-700" },
};

export default async function StudentAssignmentsListPage({
  params,
}: PageProps) {
  let session;
  try {
    session = await requireRole(["STUDENT"]);
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;

  // Authz: must be active member of this CourseOffering.
  const enrollment = await db.enrollment.findUnique({
    where: {
      studentId_courseOfferingId: {
        studentId: session.user.id,
        courseOfferingId: id,
      },
    },
    select: { id: true, removedAt: true },
  });
  if (!enrollment || enrollment.removedAt !== null) notFound();

  const course = await db.courseOffering.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      subjectCode: true,
      gradeLevel: true,
      creditHours: true,
      class: { select: { name: true } },
      term: { select: { name: true } },
      teacher: { select: { firstName: true, lastName: true } },
    },
  });
  if (!course) notFound();

  const assignments = await db.assignment.findMany({
    where: { courseOfferingId: id },
    select: {
      id: true,
      title: true,
      dueAt: true,
      isScored: true,
      submissions: {
        where: { enrollmentId: enrollment.id },
        select: { id: true, status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // eslint-disable-next-line react-hooks/purity
  const renderNow = Date.now();

  return (
    <CourseShell
      course={course}
      eyebrow="วิชาที่เรียน"
      backHref="/dashboard"
      tabs={studentCourseTabs(id)}
    >
      <div className="card p-6">
        <h2 className="text-lg font-medium text-black">การบ้าน</h2>
        <p className="mt-0.5 text-xs text-black/50">
          {assignments.length === 0
            ? "ยังไม่มีการบ้านในวิชานี้"
            : `${assignments.length} รายการ`}
        </p>

        {assignments.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-black/15 p-8 text-center">
            <FileText className="mx-auto h-7 w-7 text-black/30" />
            <p className="mt-3 text-sm text-black/60">ยังไม่มีการบ้าน</p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-black/5">
            {assignments.map((a) => {
              const ownSub = a.submissions[0];
              const status: keyof typeof STATUS_LABEL =
                ownSub?.status ?? "NOT_SUBMITTED";
              const badge = STATUS_LABEL[status];
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
              return (
                <li key={a.id}>
                  <Link
                    href={`/student/courses/${id}/assignments/${a.id}`}
                    className="flex items-start justify-between gap-3 py-3 transition-colors hover:bg-black/[0.02]"
                  >
                    <div className="min-w-0 flex-1 px-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-black">
                          {a.title}
                        </p>
                        {a.isScored && (
                          <span className="badge-gold">นับคะแนน</span>
                        )}
                      </div>
                      <p
                        className={`mt-0.5 text-xs ${isOverdue ? "text-rose-600" : "text-black/50"}`}
                      >
                        กำหนดส่ง: {dueLabel}
                      </p>
                    </div>
                    <span
                      className={`self-center rounded-md px-2 py-0.5 text-[10px] font-medium ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </CourseShell>
  );
}
