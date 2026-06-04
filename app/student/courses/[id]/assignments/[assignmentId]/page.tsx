import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { SubmitVersionForm } from "@/components/assignment/submit-version-form";

/**
 * Student Assignment detail page — Phase 6 · P6-6.
 *
 * L1-projected view:
 *   - Sees the Assignment brief + teacher's attached materials (when
 *     P6-3d wiring lands).
 *   - Sees own Submission + own version history (every SubmissionVersion
 *     they've ever submitted, ordered DESC by versionNumber).
 *   - When status=RETURNED, surfaces the teacher's PRIVATE comment(s)
 *     above the resubmit form. Other PRIVATE comments scoped to this
 *     student × this Submission also render here.
 *   - NEVER sees peers' submissions, peers' grades, or peers' comments
 *     on private threads.
 *
 * If the student has no Submission row yet (first visit), a DRAFT
 * Submission gets lazy-materialised by the first submitVersion call —
 * we issue a placeholder card here and only render the form after we
 * have a submission id. To keep that submission id stable across renders
 * before the first submit, we fall back to a no-op trick: render the
 * form without a row, but show a "ส่งงานครั้งแรก" affordance that POSTs
 * to a server action which does findOrCreateSubmission inline. Phase 6
 * MVP: we render the form using the existing Submission row if it
 * exists; otherwise we lazy-materialize on first submit through
 * submitVersion (which calls findOrCreateSubmission internally).
 */

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string; assignmentId: string }>;
}

export default async function StudentAssignmentDetailPage({
  params,
}: PageProps) {
  let session;
  try {
    session = await requireRole(["STUDENT"]);
  } catch {
    redirect("/dashboard");
  }
  const { id: courseId, assignmentId } = await params;

  // Authz — active enrollment in this CourseOffering.
  const enrollment = await db.enrollment.findUnique({
    where: {
      studentId_courseOfferingId: {
        studentId: session.user.id,
        courseOfferingId: courseId,
      },
    },
    select: { id: true, removedAt: true },
  });
  if (!enrollment || enrollment.removedAt !== null) notFound();

  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      courseOfferingId: true,
      title: true,
      description: true,
      dueAt: true,
      allowText: true,
      allowFile: true,
      allowLink: true,
      submissionClosed: true,
      autoCloseAtDue: true,
      isScored: true,
      scoreItem: {
        select: {
          id: true,
          fullScore: true,
          publishedAt: true,
        },
      },
    },
  });
  if (!assignment || assignment.courseOfferingId !== courseId) notFound();

  // Own Submission (L1 — never join other students' rows).
  const submission = await db.submission.findUnique({
    where: {
      assignmentId_enrollmentId: {
        assignmentId,
        enrollmentId: enrollment.id,
      },
    },
    select: {
      id: true,
      status: true,
      versions: {
        select: {
          id: true,
          versionNumber: true,
          textContent: true,
          links: true,
          submittedAt: true,
          isLate: true,
          isCurrent: true,
        },
        orderBy: { versionNumber: "desc" },
      },
    },
  });

  // Own ScoreEntry for the linked ScoreItem (if scored + published).
  const showGrade =
    assignment.isScored &&
    assignment.scoreItem !== null &&
    assignment.scoreItem.publishedAt !== null;
  const grade = showGrade
    ? await db.scoreEntry.findUnique({
        where: {
          scoreItemId_enrollmentId: {
            scoreItemId: assignment.scoreItem!.id,
            enrollmentId: enrollment.id,
          },
        },
        select: { value: true },
      })
    : null;

  // PRIVATE comments scoped to this Submission (student sees own + teacher's).
  const comments = submission
    ? await db.comment.findMany({
        where: {
          ownerType: "SUBMISSION",
          ownerId: submission.id,
          deletedAt: null,
        },
        select: {
          id: true,
          body: true,
          createdAt: true,
          authorId: true,
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const dueLabel = assignment.dueAt
    ? new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
        timeZone: "Asia/Bangkok",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(assignment.dueAt)
    : "ส่งเมื่อพร้อม";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link
        href={`/student/courses/${courseId}/assignments`}
        className="inline-flex items-center gap-1 text-xs text-black/50 hover:text-black"
      >
        <ChevronLeft className="h-3 w-3" /> กลับไปยังรายการการบ้าน
      </Link>

      <div className="card mt-3 p-6">
        <h1 className="text-xl font-medium text-black">{assignment.title}</h1>
        <p className="mt-1 text-xs text-black/50">
          กำหนดส่ง: {dueLabel}
          {assignment.isScored && (
            <span className="ml-3 badge-gold">นับคะแนน</span>
          )}
        </p>
        {assignment.description && (
          <div className="mt-4 whitespace-pre-wrap text-sm text-black/80">
            {assignment.description}
          </div>
        )}
        {showGrade && grade && (
          <div className="mt-4 rounded-lg bg-blue-50 p-3 text-sm">
            <span className="font-medium text-blue-900">คะแนนของคุณ: </span>
            {grade.value}/{assignment.scoreItem?.fullScore}
          </div>
        )}
      </div>

      {submission?.status === "RETURNED" && (
        <div className="card mt-4 border-rose-200 bg-rose-50/50 p-4">
          <h3 className="text-sm font-medium text-rose-900">
            ครูส่งคืน — รอแก้ไขและส่งใหม่
          </h3>
          <p className="mt-1 text-xs text-rose-800/70">
            อ่าน comment ของครูในหัวข้อ &quot;ข้อความ&quot; ด้านล่าง
          </p>
        </div>
      )}

      {comments.length > 0 && (
        <div className="card mt-4 p-4">
          <h3 className="text-sm font-medium text-black">ข้อความจากครู</h3>
          <ul className="mt-3 space-y-2">
            {comments.map((c) => (
              <li
                key={c.id}
                className="rounded-md bg-black/[0.03] p-2 text-xs text-black/80"
              >
                <p className="whitespace-pre-wrap">{c.body}</p>
                <p className="mt-1 text-[10px] text-black/40">
                  {new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
                    timeZone: "Asia/Bangkok",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(c.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card mt-4 p-6">
        <h3 className="text-sm font-medium text-black">ส่งงาน</h3>
        {assignment.submissionClosed ? (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
            ครูปิดการส่งแล้ว
          </p>
        ) : submission ? (
          <div className="mt-3">
            <SubmitVersionForm
              courseId={courseId}
              assignmentId={assignmentId}
              submissionId={submission.id}
              allowText={assignment.allowText}
              allowLink={assignment.allowLink}
              hasExistingCurrent={submission.versions.some((v) => v.isCurrent)}
            />
          </div>
        ) : (
          <p className="mt-3 text-xs text-black/50">
            ระบบจะสร้าง draft submission ให้อัตโนมัติเมื่อกดส่งครั้งแรก — กรุณา
            reload หน้านี้หลังการส่งครั้งแรก
          </p>
        )}
      </div>

      {submission && submission.versions.length > 0 && (
        <div className="card mt-4 p-6">
          <h3 className="text-sm font-medium text-black">ประวัติการส่ง</h3>
          <ul className="mt-3 space-y-3">
            {submission.versions.map((v) => (
              <li
                key={v.id}
                className={`rounded-lg border p-3 ${
                  v.isCurrent
                    ? "border-emerald-200 bg-emerald-50/30"
                    : "border-black/10 bg-black/[0.02]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-black">
                    เวอร์ชัน {v.versionNumber}
                    {v.isCurrent && (
                      <span className="ml-2 text-[10px] text-emerald-700">
                        (ปัจจุบัน)
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-black/40">
                    {new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
                      timeZone: "Asia/Bangkok",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(v.submittedAt)}
                    {v.isLate && (
                      <span className="ml-2 rounded bg-amber-100 px-1 text-[9px] text-amber-800">
                        ส่งสาย
                      </span>
                    )}
                  </p>
                </div>
                {v.textContent && (
                  <p className="mt-2 whitespace-pre-wrap text-xs text-black/70">
                    {v.textContent}
                  </p>
                )}
                {Array.isArray(v.links) && v.links.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {(v.links as string[]).map((href, i) => (
                      <li
                        key={i}
                        className="text-[11px] text-blue-700 hover:underline"
                      >
                        <a href={href} target="_blank" rel="noreferrer">
                          {href}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
