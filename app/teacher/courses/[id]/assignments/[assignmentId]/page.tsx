import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { assert } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { GradeSubmissionDialog } from "@/components/assignment/grade-submission-dialog";
import { ReturnSubmissionDialog } from "@/components/assignment/return-submission-dialog";
import { CommentsThread } from "@/components/comment/comments-thread";

/**
 * Teacher Assignment detail page — Phase 6 · P6-5b.
 *
 * Shows:
 *   - Header: title / due / scored badge / linked ScoreItem state
 *   - Description (markdown subset, rendered as text for now)
 *   - Submission grid: active ∪ ever-submitted enrollments (Pattern 14)
 *     × status badge + per-row "ตรวจ" / "ส่งคืน" dialogs.
 *
 * `assert.canMutateAssignment` returns the assignment row inline; we
 * still fetch the course shell separately because the CourseShell
 * component expects the full course shape.
 */

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string; assignmentId: string }>;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  NOT_SUBMITTED: { label: "ยังไม่ส่ง", color: "bg-black/[0.05] text-black/60" },
  DRAFT: { label: "ร่าง", color: "bg-black/[0.05] text-black/60" },
  SUBMITTED: { label: "ส่งแล้ว", color: "bg-emerald-50 text-emerald-700" },
  LATE_SUBMITTED: {
    label: "ส่งสาย",
    color: "bg-amber-50 text-amber-700",
  },
  RETURNED: { label: "ส่งคืน", color: "bg-rose-50 text-rose-700" },
  GRADED: { label: "ตรวจแล้ว", color: "bg-blue-50 text-blue-700" },
};

export default async function AssignmentDetailPage({ params }: PageProps) {
  const { id: courseId, assignmentId } = await params;

  let assignment;
  let session;
  try {
    const result = await assert.canMutateAssignment(assignmentId);
    assignment = result.assignment;
    session = result.session;
  } catch {
    redirect("/dashboard");
  }
  if (assignment.courseOfferingId !== courseId) notFound();

  // Pattern 14 — active ∪ ever-submitted union.
  // We pull all active enrollments + all enrollments that have a Submission
  // row on this Assignment, then dedupe on enrollment.id.
  const [activeEnrollments, submittedEnrollments, fullAssignment] =
    await Promise.all([
      db.enrollment.findMany({
        where: { courseOfferingId: courseId, removedAt: null },
        select: {
          id: true,
          studentId: true,
          removedAt: true,
          student: {
            select: { firstName: true, lastName: true, studentId: true },
          },
        },
      }),
      db.enrollment.findMany({
        where: {
          courseOfferingId: courseId,
          submissions: { some: { assignmentId } },
        },
        select: {
          id: true,
          studentId: true,
          removedAt: true,
          student: {
            select: { firstName: true, lastName: true, studentId: true },
          },
        },
      }),
      db.assignment.findUnique({
        where: { id: assignmentId },
        select: {
          id: true,
          title: true,
          description: true,
          dueAt: true,
          isScored: true,
          submissionClosed: true,
          autoCloseAtDue: true,
          scoreItem: {
            select: { id: true, fullScore: true, publishedAt: true },
          },
        },
      }),
    ]);
  if (!fullAssignment) notFound();

  // Union + dedupe.
  const enrollmentMap = new Map<string, (typeof activeEnrollments)[number]>();
  for (const e of activeEnrollments) enrollmentMap.set(e.id, e);
  for (const e of submittedEnrollments) {
    if (!enrollmentMap.has(e.id)) enrollmentMap.set(e.id, e);
  }
  const enrollments = Array.from(enrollmentMap.values()).sort((a, b) =>
    a.student.lastName.localeCompare(b.student.lastName, "th")
  );
  const enrollmentIds = enrollments.map((e) => e.id);

  // Fetch submissions for the joined set in one query.
  const submissions = await db.submission.findMany({
    where: { assignmentId, enrollmentId: { in: enrollmentIds } },
    select: {
      id: true,
      enrollmentId: true,
      status: true,
      versions: {
        where: { isCurrent: true },
        select: { isLate: true, submittedAt: true, versionNumber: true },
      },
    },
  });

  // For scored Assignments: fetch the linked ScoreEntry values.
  const linkedEntries = fullAssignment.scoreItem
    ? await db.scoreEntry.findMany({
        where: {
          scoreItemId: fullAssignment.scoreItem.id,
          enrollmentId: { in: enrollmentIds },
        },
        select: { enrollmentId: true, value: true },
      })
    : [];
  const entryByEnrollment = new Map(
    linkedEntries.map((e) => [e.enrollmentId, e.value])
  );
  const submissionByEnrollment = new Map(
    submissions.map((s) => [s.enrollmentId, s])
  );

  const dueLabel = fullAssignment.dueAt
    ? new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
        timeZone: "Asia/Bangkok",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(fullAssignment.dueAt)
    : "ส่งเมื่อพร้อม";

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Link
        href={`/teacher/courses/${courseId}/assignments`}
        className="inline-flex items-center gap-1 text-xs text-black/50 hover:text-black"
      >
        <ChevronLeft className="h-3 w-3" /> กลับไปยังรายการการบ้าน
      </Link>

      <div className="card mt-3 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-medium text-black">
              {fullAssignment.title}
            </h1>
            <p className="mt-1 text-xs text-black/50">
              กำหนดส่ง: {dueLabel}
              {fullAssignment.isScored && (
                <span className="ml-3 badge-gold">
                  นับคะแนน · {fullAssignment.scoreItem?.fullScore} เต็ม
                  {fullAssignment.scoreItem?.publishedAt && (
                    <span className="ml-1">(เผยแพร่)</span>
                  )}
                </span>
              )}
            </p>
          </div>
        </div>
        {fullAssignment.description && (
          <div className="mt-4 whitespace-pre-wrap text-sm text-black/80">
            {fullAssignment.description}
          </div>
        )}
      </div>

      <div className="card mt-4 p-6">
        <h2 className="text-base font-medium text-black">
          ผู้ส่งงาน ({enrollments.length} คน)
        </h2>

        {enrollments.length === 0 ? (
          <p className="mt-3 text-xs text-black/50">
            ยังไม่มีนักเรียนใน CourseOffering นี้
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-black/5">
            {enrollments.map((enr) => {
              const submission = submissionByEnrollment.get(enr.id);
              const current = submission?.versions[0];
              const status: keyof typeof STATUS_LABEL =
                submission?.status ?? "NOT_SUBMITTED";
              const badge = STATUS_LABEL[status];
              const value = entryByEnrollment.get(enr.id) ?? null;
              const fullName = `${enr.student.firstName} ${enr.student.lastName}`;
              const isRemoved = enr.removedAt !== null;
              return (
                <li
                  key={enr.id}
                  className={`flex flex-wrap items-center justify-between gap-2 py-2 ${
                    isRemoved ? "opacity-60" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1 px-2">
                    <p className="text-sm text-black">{fullName}</p>
                    <p className="text-[10px] text-black/40">
                      {enr.student.studentId}
                      {isRemoved && (
                        <span className="ml-2 rounded bg-rose-100 px-1 py-0.5 text-[9px] text-rose-700">
                          นำออกจากห้อง
                        </span>
                      )}
                      {current?.isLate && (
                        <span className="ml-2 rounded bg-amber-100 px-1 py-0.5 text-[9px] text-amber-800">
                          ส่งสาย v{current.versionNumber}
                        </span>
                      )}
                    </p>
                  </div>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${badge.color}`}
                  >
                    {badge.label}
                  </span>
                  {fullAssignment.isScored && value !== null && (
                    <span className="text-xs text-black/60">
                      {value}/{fullAssignment.scoreItem?.fullScore}
                    </span>
                  )}
                  {submission ? (
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/teacher/courses/${courseId}/assignments/${assignmentId}/submissions/${submission.id}`}
                        className="text-xs text-black/60 hover:text-black hover:underline"
                      >
                        ดูข้อความ →
                      </Link>
                      <GradeSubmissionDialog
                        courseId={courseId}
                        assignmentId={assignmentId}
                        submissionId={submission.id}
                        studentName={fullName}
                        currentValue={value}
                        fullScore={fullAssignment.scoreItem?.fullScore ?? null}
                        isScored={fullAssignment.isScored}
                        isScoreItemPublished={
                          fullAssignment.scoreItem?.publishedAt !== null &&
                          fullAssignment.scoreItem?.publishedAt !== undefined
                        }
                      />
                      <ReturnSubmissionDialog
                        courseId={courseId}
                        assignmentId={assignmentId}
                        submissionId={submission.id}
                        studentName={fullName}
                      />
                    </div>
                  ) : (
                    <span className="text-[10px] text-black/30 px-2">—</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-4">
        <CommentsThread
          ownerType="ASSIGNMENT"
          ownerId={fullAssignment.id}
          courseOfferingId={courseId}
          scope="CLASS_WIDE"
          session={session}
        />
      </div>
    </div>
  );
}
