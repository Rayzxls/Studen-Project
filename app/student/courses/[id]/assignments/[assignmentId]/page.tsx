import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  FileText,
  History,
  Link2 as LinkIcon,
  MessageSquare,
  MoreVertical,
  Paperclip,
} from "lucide-react";
import type { SubmissionStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { SubmitVersionForm } from "@/components/assignment/submit-version-form";
import { WithdrawSubmissionButton } from "@/components/assignment/withdraw-submission-button";
import { HideVersionButton } from "@/components/assignment/hide-version-button";
import { CommentsThread } from "@/components/comment/comments-thread";
import { ensureSubmission } from "@/lib/assignment/submission";
import { AssignmentAttachmentGallery } from "@/components/assignment/assignment-attachment-gallery";
import { SafeExternalLinkButton } from "@/components/link/safe-external-link-button";
import { getModerationRestriction } from "@/lib/moderation/queries";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string; assignmentId: string }>;
}

const statusCopy: Record<
  SubmissionStatus,
  { label: string; tone: string; note: string }
> = {
  NOT_SUBMITTED: {
    label: "ยังไม่ได้ส่ง",
    tone: "badge",
    note: "ส่งงานได้จากกล่องนี้",
  },
  DRAFT: {
    label: "ยังไม่ได้ส่ง",
    tone: "badge",
    note: "ยังไม่มีงานที่อยู่ในคิวรอตรวจ",
  },
  SUBMITTED: {
    label: "ส่งแล้ว",
    tone: "badge badge-success",
    note: "ครูจะเห็นเวอร์ชันล่าสุดของคุณ",
  },
  LATE_SUBMITTED: {
    label: "ส่งสาย",
    tone: "badge badge-warn",
    note: "ส่งแล้วหลังเวลาที่กำหนด",
  },
  RETURNED: {
    label: "ครูส่งคืนให้แก้",
    tone: "badge badge-danger",
    note: "ครูส่งคืนพร้อมคำแนะนำ (ดูในแจ้งเตือน) — แก้ไขแล้วส่งใหม่ได้เลย",
  },
  GRADED: {
    label: "ตรวจแล้ว",
    tone: "badge badge-info",
    note: "งานนี้มีผลการตรวจแล้ว",
  },
};

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
      linkUrls: true,
      fileAttachmentIds: true,
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
  if (await getModerationRestriction("ASSIGNMENT", assignment.id)) notFound();

  const assignmentFileIds = jsonStringArray(assignment.fileAttachmentIds);
  const assignmentFileRows =
    assignmentFileIds.length > 0
      ? await db.fileAttachment.findMany({
          where: { id: { in: assignmentFileIds }, deletedAt: null },
          select: {
            id: true,
            originalFilename: true,
            sizeBytes: true,
            mimeType: true,
          },
        })
      : [];
  const assignmentFileById = new Map(
    assignmentFileRows.map((file) => [file.id, file])
  );
  const assignmentFiles = assignmentFileIds
    .map((fileId) => assignmentFileById.get(fileId))
    .filter((file): file is (typeof assignmentFileRows)[number] =>
      Boolean(file)
    );

  if (!assignment.submissionClosed) {
    await ensureSubmission(assignmentId, enrollment.id);
  }

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
        // Student view hides versions they removed; the teacher's submission
        // page selects all versions (history is preserved — ADR-0020).
        where: { hiddenFromStudentAt: null },
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

  const hasCurrentVersion =
    submission?.versions.some((version) => version.isCurrent) ?? false;
  const currentStatus = hasCurrentVersion
    ? (submission?.status ?? "NOT_SUBMITTED")
    : "DRAFT";
  const status = statusCopy[currentStatus];
  // Withdraw only applies while the work is actually waiting in the
  // teacher's review queue. RETURNED work is already out of the queue —
  // the student's path there is "แก้ไขงาน" (resubmit), never withdraw
  // (the lib layer rejects it too). GRADED is final.
  const canWithdrawSubmittedWork =
    Boolean(submission) &&
    hasCurrentVersion &&
    (currentStatus === "SUBMITTED" || currentStatus === "LATE_SUBMITTED") &&
    !assignment.submissionClosed;

  return (
    <>
      <div className="lg:hidden">
        <div className="min-h-[100svh] bg-bg text-black">
          <header className="glass-nav sticky top-0 z-30 flex h-16 items-center justify-between px-4">
            <Link
              href={`/student/courses/${courseId}/assignments`}
              className="grid h-11 w-11 place-items-center rounded-full text-black/55 transition hover:bg-black/5 hover:text-black"
              aria-label="กลับ"
            >
              <ChevronLeft className="h-7 w-7" aria-hidden="true" />
            </Link>
            <button
              type="button"
              className="grid h-11 w-11 place-items-center rounded-full text-black/45 transition hover:bg-black/5 hover:text-black"
              aria-label="เมนูเพิ่มเติม"
            >
              <MoreVertical className="h-6 w-6" aria-hidden="true" />
            </button>
          </header>

          <main className="px-4 pb-76 pt-4">
            <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_14px_38px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.04]">
              <div className="h-1.5 bg-blue-500" />
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-500 p-[2px]">
                    <div className="grid h-full w-full place-items-center rounded-full bg-surface">
                      <FileText
                        className="h-5 w-5 text-blue-500"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-black/50">
                      โพสต์งานจากครู
                    </p>
                    <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-normal text-black">
                      {assignment.title}
                    </h1>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 ring-1 ring-blue-500/10">
                    <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                    {dueLabel}
                  </span>
                  {assignment.isScored && (
                    <span className="badge badge-info">
                      {assignment.scoreItem?.fullScore ?? "-"} คะแนน
                    </span>
                  )}
                </div>

                <a
                  href="#class-comments"
                  className="mt-5 flex min-h-11 items-center gap-2 rounded-2xl bg-black/[0.025] px-4 py-3 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
                >
                  <MessageSquare className="h-5 w-5" aria-hidden="true" />
                  <span>เพิ่มความคิดเห็นในชั้นเรียน</span>
                </a>

                {assignment.description && (
                  <div className="assignment-brief-panel mt-5 whitespace-pre-wrap rounded-[22px] p-4 text-[15px] leading-7">
                    {assignment.description}
                  </div>
                )}

                <AssignmentDetailSummary
                  dueLabel={dueLabel}
                  fullScore={
                    assignment.isScored
                      ? (assignment.scoreItem?.fullScore ?? null)
                      : null
                  }
                  allowText={assignment.allowText}
                  allowFile={assignment.allowFile}
                  allowLink={assignment.allowLink}
                  attachmentCount={assignmentFiles.length}
                  linkCount={
                    Array.isArray(assignment.linkUrls)
                      ? assignment.linkUrls.length
                      : 0
                  }
                />

                <AssignmentAttachmentGallery files={assignmentFiles} />
              </div>
            </section>

            {Array.isArray(assignment.linkUrls) &&
              assignment.linkUrls.length > 0 && (
                <div className="mt-4 space-y-3">
                  {(assignment.linkUrls as string[]).map((href, index) => (
                    <SafeExternalLinkButton
                      key={`${href}-${index}`}
                      href={href}
                      className="block w-full truncate rounded-2xl border border-black/[0.08] bg-black/[0.025] px-4 py-3 text-left text-sm font-medium text-blue-700 shadow-lift transition hover:border-blue-500/30 hover:bg-black/[0.04] hover:no-underline"
                    >
                      {href}
                    </SafeExternalLinkButton>
                  ))}
                </div>
              )}

            <section id="class-comments" className="mt-4 scroll-mt-20">
              <CommentsThread
                ownerType="ASSIGNMENT"
                ownerId={assignmentId}
                courseOfferingId={courseId}
                scope="CLASS_WIDE"
                session={session}
                title="ความคิดเห็นในชั้นเรียน"
                emptyText="ยังไม่มีคอมเมนต์ใต้โพสต์นี้ — เป็นคนแรกเลย"
                variant="social"
              />
            </section>
          </main>

          <section className="fixed inset-x-0 bottom-0 z-40 max-h-[85svh] overflow-y-auto rounded-t-[30px] bg-white px-5 pb-6 pt-4 text-black shadow-[0_-20px_60px_rgba(15,23,42,0.16)] ring-1 ring-black/[0.05]">
            <div className="mx-auto mb-6 h-1.5 w-14 rounded-full bg-black/18" />
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold tracking-normal">
                งานของคุณ
              </h2>
              <span className={`${status.tone} shrink-0`}>{status.label}</span>
            </div>

            {showGrade && grade && (
              <div className="mb-4 rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
                คะแนนของคุณ:{" "}
                <span className="font-semibold text-blue-900">
                  {grade.value}/{assignment.scoreItem?.fullScore}
                </span>
              </div>
            )}

            {assignment.submissionClosed ? (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                ครูปิดการส่งแล้ว
              </p>
            ) : submission ? (
              <SubmitVersionForm
                courseId={courseId}
                assignmentId={assignmentId}
                submissionId={submission.id}
                allowText={assignment.allowText}
                allowFile={assignment.allowFile}
                allowLink={assignment.allowLink}
                hasExistingCurrent={hasCurrentVersion}
                startCollapsed
                collapsedLabel={hasCurrentVersion ? "แก้ไขงาน" : "+  เพิ่มงาน"}
                collapsedButtonClassName="w-full rounded-full bg-blue-500 px-6 py-3.5 text-center text-lg font-semibold text-white shadow-[0_12px_28px_rgba(10,132,255,0.22)] transition hover:bg-blue-600"
              />
            ) : null}

            {canWithdrawSubmittedWork && submission && (
              <div className="mt-3">
                <WithdrawSubmissionButton
                  courseId={courseId}
                  assignmentId={assignmentId}
                  submissionId={submission.id}
                />
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="hidden lg:block mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Link
          href={`/student/courses/${courseId}/assignments`}
          className="inline-flex items-center gap-1 text-xs text-black/50 transition hover:text-black"
        >
          <ChevronLeft className="h-3 w-3" /> กลับไปยังรายการการบ้าน
        </Link>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <main className="order-1 min-w-0 space-y-5 lg:order-none">
            <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.04]">
              <div className="h-1.5 bg-blue-500" />
              <div className="p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blue-500 p-[2px]">
                      <div className="grid h-full w-full place-items-center rounded-full bg-surface">
                        <FileText
                          className="h-5 w-5 text-[#0a84ff]"
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-black/55">
                        โพสต์งานจากครู
                      </p>
                      <h1 className="mt-1 text-2xl font-semibold leading-tight text-black sm:text-3xl">
                        {assignment.title}
                      </h1>
                    </div>
                  </div>
                  <span className={`${status.tone} shrink-0`}>
                    {status.label}
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap gap-2 text-xs text-black/55">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 font-medium text-blue-700 ring-1 ring-blue-500/10">
                    <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                    กำหนดส่ง: {dueLabel}
                  </span>
                  {assignment.isScored && (
                    <span className="badge badge-info">
                      นับคะแนน {assignment.scoreItem?.fullScore ?? "-"} คะแนน
                    </span>
                  )}
                  {assignment.submissionClosed && (
                    <span className="badge badge-danger">ปิดการส่งแล้ว</span>
                  )}
                </div>

                {assignment.description && (
                  <div className="assignment-brief-panel mt-6 whitespace-pre-wrap rounded-[24px] p-5 text-[15px] leading-7">
                    {assignment.description}
                  </div>
                )}

                <AssignmentDetailSummary
                  dueLabel={dueLabel}
                  fullScore={
                    assignment.isScored
                      ? (assignment.scoreItem?.fullScore ?? null)
                      : null
                  }
                  allowText={assignment.allowText}
                  allowFile={assignment.allowFile}
                  allowLink={assignment.allowLink}
                  attachmentCount={assignmentFiles.length}
                  linkCount={
                    Array.isArray(assignment.linkUrls)
                      ? assignment.linkUrls.length
                      : 0
                  }
                />

                <AssignmentAttachmentGallery files={assignmentFiles} />

                {Array.isArray(assignment.linkUrls) &&
                  assignment.linkUrls.length > 0 && (
                    <div className="mt-5">
                      <p className="flex items-center gap-1.5 text-xs font-medium text-black/60">
                        <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        ลิงก์ประกอบงาน
                      </p>
                      <ul className="mt-2 grid gap-2">
                        {(assignment.linkUrls as string[]).map(
                          (href, index) => (
                            <li key={`${href}-${index}`}>
                              <SafeExternalLinkButton
                                href={href}
                                className="block w-full truncate rounded-2xl border border-black/[0.08] bg-black/[0.025] px-3 py-2 text-left text-sm font-medium text-blue-700 underline-offset-2 transition hover:border-blue-500/30 hover:bg-black/[0.04] hover:no-underline"
                              >
                                {href}
                              </SafeExternalLinkButton>
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
              </div>
            </section>

            <CommentsThread
              ownerType="ASSIGNMENT"
              ownerId={assignmentId}
              courseOfferingId={courseId}
              scope="CLASS_WIDE"
              session={session}
              title="ความคิดเห็นในชั้นเรียน"
              emptyText="ยังไม่มีคอมเมนต์ใต้โพสต์นี้ — เป็นคนแรกเลย"
              variant="social"
            />
          </main>

          <aside className="order-2 space-y-5 lg:order-none lg:sticky lg:top-24">
            <section className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium text-black">ส่งงาน</h2>
                  <p className="mt-1 text-xs leading-5 text-black/50">
                    {status.note}
                  </p>
                </div>
                {currentStatus === "RETURNED" ? (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                ) : hasCurrentVersion ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <FileText className="h-5 w-5 text-black/35" />
                )}
              </div>

              <div className="mt-4 rounded-2xl bg-black/[0.025] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-black/50">
                    สถานะล่าสุด
                  </span>
                  <span className={status.tone}>{status.label}</span>
                </div>
                {showGrade && grade && (
                  <div className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-700">
                    คะแนนของคุณ:{" "}
                    <span className="font-medium">
                      {grade.value}/{assignment.scoreItem?.fullScore}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-3">
                {assignment.submissionClosed ? (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                    ครูปิดการส่งแล้ว
                  </p>
                ) : submission ? (
                  <SubmitVersionForm
                    courseId={courseId}
                    assignmentId={assignmentId}
                    submissionId={submission.id}
                    allowText={assignment.allowText}
                    allowFile={assignment.allowFile}
                    allowLink={assignment.allowLink}
                    hasExistingCurrent={hasCurrentVersion}
                  />
                ) : (
                  <p className="text-xs leading-5 text-black/50">
                    รีเฟรชหน้านี้อีกครั้งเพื่อเริ่มส่งงาน
                  </p>
                )}

                {canWithdrawSubmittedWork && submission && (
                  <WithdrawSubmissionButton
                    courseId={courseId}
                    assignmentId={assignmentId}
                    submissionId={submission.id}
                  />
                )}
              </div>
            </section>

            {submission && submission.versions.length > 0 && (
              <section className="card p-5">
                <div className="flex items-center gap-2">
                  <History
                    className="h-4 w-4 text-black/40"
                    aria-hidden="true"
                  />
                  <h2 className="text-base font-medium text-black">
                    ประวัติการส่ง
                  </h2>
                </div>
                <ul className="mt-4 space-y-3">
                  {submission.versions.map((version) => (
                    <li
                      key={version.id}
                      className={`rounded-2xl border p-3 ${
                        version.isCurrent
                          ? "border-green-200 bg-green-50/40"
                          : "border-black/10 bg-black/[0.02]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium text-black">
                            การส่งครั้งที่ {version.versionNumber}
                          </p>
                          <p className="mt-1 text-[11px] text-black/45">
                            {new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
                              timeZone: "Asia/Bangkok",
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(version.submittedAt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <div className="flex gap-1">
                            {version.isCurrent && (
                              <span className="badge badge-success">
                                ล่าสุด
                              </span>
                            )}
                            {!version.isCurrent && (
                              <span className="badge">เก็บไว้</span>
                            )}
                            {version.isLate && (
                              <span className="badge badge-warn">ส่งสาย</span>
                            )}
                          </div>
                          {!version.isCurrent && (
                            <HideVersionButton
                              courseId={courseId}
                              assignmentId={assignmentId}
                              submissionId={submission.id}
                              versionId={version.id}
                              label={`การส่งครั้งที่ ${version.versionNumber}`}
                            />
                          )}
                        </div>
                      </div>
                      {version.textContent && (
                        <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-xs leading-5 text-black/65">
                          {version.textContent}
                        </p>
                      )}
                      {Array.isArray(version.links) &&
                        version.links.length > 0 && (
                          <ul className="mt-3 space-y-1">
                            {(version.links as string[]).map((href, index) => (
                              <li key={`${href}-${index}`}>
                                <SafeExternalLinkButton
                                  href={href}
                                  className="block w-full truncate text-left text-[11px] text-blue-700 hover:underline"
                                >
                                  {href}
                                </SafeExternalLinkButton>
                              </li>
                            ))}
                          </ul>
                        )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}

function AssignmentDetailSummary({
  dueLabel,
  fullScore,
  allowText,
  allowFile,
  allowLink,
  attachmentCount,
  linkCount,
}: {
  dueLabel: string;
  fullScore: number | null;
  allowText: boolean;
  allowFile: boolean;
  allowLink: boolean;
  attachmentCount: number;
  linkCount: number;
}) {
  const submitMethods = [
    allowText ? "ข้อความ" : null,
    allowFile ? "ไฟล์" : null,
    allowLink ? "ลิงก์" : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-2xl border border-black/[0.06] bg-black/[0.025] px-4 py-3">
        <p className="flex items-center gap-1.5 text-xs font-medium text-black/45">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
          กำหนดส่ง
        </p>
        <p className="mt-1 text-sm font-semibold text-black">{dueLabel}</p>
      </div>
      <div className="rounded-2xl border border-black/[0.06] bg-black/[0.025] px-4 py-3">
        <p className="flex items-center gap-1.5 text-xs font-medium text-black/45">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          คะแนน
        </p>
        <p className="mt-1 text-sm font-semibold text-black">
          {fullScore === null ? "ไม่นับคะแนน" : `${fullScore} คะแนน`}
        </p>
      </div>
      <div className="rounded-2xl border border-black/[0.06] bg-black/[0.025] px-4 py-3">
        <p className="flex items-center gap-1.5 text-xs font-medium text-black/45">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          ส่งได้ด้วย
        </p>
        <p className="mt-1 text-sm font-semibold text-black">
          {submitMethods.join(" / ")}
        </p>
      </div>
      <div className="rounded-2xl border border-black/[0.06] bg-black/[0.025] px-4 py-3">
        <p className="flex items-center gap-1.5 text-xs font-medium text-black/45">
          <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
          ไฟล์ประกอบ
        </p>
        <p className="mt-1 text-sm font-semibold text-black">
          {attachmentCount + linkCount} รายการ
        </p>
      </div>
    </div>
  );
}

function jsonStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((item): item is string => typeof item === "string")
    : [];
}
