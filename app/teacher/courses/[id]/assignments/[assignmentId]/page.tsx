import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  FileText,
  Link2 as LinkIcon,
  MessageSquare,
} from "lucide-react";
import type { SubmissionStatus } from "@prisma/client";
import { assert } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { CommentsThread } from "@/components/comment/comments-thread";
import { ReviewPanel } from "@/components/assignment/review-panel";
import { UserAvatar } from "@/components/profile/user-avatar";
import { SubmissionFilePreview } from "@/components/assignment/submission-file-preview";
import { SafeExternalLinkButton } from "@/components/link/safe-external-link-button";
import { getModerationRestriction } from "@/lib/moderation/queries";

/**
 * Teacher Assignment Review Workspace — Phase 11.
 *
 * Master-detail single-page grading flow (CONTEXT § Assignment Review
 * Workspace). Replaces the old list + per-submission-detail navigation:
 *
 *   Left   — submission queue. Default tab "รอตรวจ" (SUBMITTED +
 *            LATE_SUBMITTED) ordered by current version submittedAt ASC.
 *            Tabs: รอตรวจ / ส่งคืนแล้ว / ตรวจแล้ว / ทั้งหมด.
 *   Center — the selected student's submitted work (text / links / files /
 *            version history) + a collapsible "ความคิดเห็นส่วนตัว" PRIVATE
 *            conversation.
 *   Right  — ReviewPanel: confirm (grade + GRADED) or return-for-revision,
 *            each advancing to the next queued submission via server redirect.
 *
 * Selection is URL-driven (`?sid=` + `?filter=`) so the server can render
 * the PRIVATE conversation (privacy boundary stays server-side) and the
 * grade actions can redirect to the next item without client routing.
 *
 * Pattern 14 — the queue is the active ∪ ever-submitted enrollment union.
 */

export const dynamic = "force-dynamic";

type Filter = "pending" | "returned" | "graded" | "all";

interface PageProps {
  params: Promise<{ id: string; assignmentId: string }>;
  searchParams: Promise<{ sid?: string; filter?: string }>;
}

const STATUS_LABEL: Record<SubmissionStatus, { label: string; color: string }> =
  {
    NOT_SUBMITTED: {
      label: "ยังไม่ส่ง",
      color: "bg-black/[0.05] text-black/55",
    },
    DRAFT: { label: "ยังไม่ส่ง", color: "bg-black/[0.05] text-black/55" },
    SUBMITTED: { label: "ส่งแล้ว", color: "bg-green-50 text-green-700" },
    LATE_SUBMITTED: { label: "ส่งสาย", color: "bg-orange-50 text-orange-700" },
    RETURNED: { label: "ส่งคืนแล้ว", color: "bg-red-50 text-red-700" },
    GRADED: { label: "ตรวจแล้ว", color: "bg-blue-50 text-blue-700" },
  };

const FILTER_TABS: { key: Filter; label: string }[] = [
  { key: "pending", label: "รอตรวจ" },
  { key: "returned", label: "ส่งคืนแล้ว" },
  { key: "graded", label: "ตรวจแล้ว" },
  { key: "all", label: "ทั้งหมด" },
];

const dateFmt = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  timeZone: "Asia/Bangkok",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const dueFmt = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  timeZone: "Asia/Bangkok",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AssignmentReviewWorkspacePage({
  params,
  searchParams,
}: PageProps) {
  const { id: courseId, assignmentId } = await params;
  const { sid, filter: filterRaw } = await searchParams;
  const filter: Filter = (
    ["pending", "returned", "graded", "all"] as const
  ).includes(filterRaw as Filter)
    ? (filterRaw as Filter)
    : "pending";

  let session;
  try {
    const result = await assert.canMutateAssignment(assignmentId);
    session = result.session;
    if (result.assignment.courseOfferingId !== courseId) notFound();
  } catch {
    redirect("/dashboard");
  }

  // Pattern 14 — active ∪ ever-submitted enrollment union.
  const [activeEnrollments, submittedEnrollments, assignment] =
    await Promise.all([
      db.enrollment.findMany({
        where: { courseOfferingId: courseId, removedAt: null },
        select: {
          id: true,
          removedAt: true,
          student: {
            select: {
              userId: true,
              firstName: true,
              lastName: true,
              studentId: true,
              user: { select: { profileImageId: true } },
            },
          },
        },
      }),
      db.enrollment.findMany({
        where: {
          courseOfferingId: courseId,
          submissions: { some: { assignmentId, versions: { some: {} } } },
        },
        select: {
          id: true,
          removedAt: true,
          student: {
            select: {
              userId: true,
              firstName: true,
              lastName: true,
              studentId: true,
              user: { select: { profileImageId: true } },
            },
          },
        },
      }),
      db.assignment.findUnique({
        where: { id: assignmentId },
        select: {
          id: true,
          title: true,
          description: true,
          linkUrls: true,
          dueAt: true,
          isScored: true,
          scoreItem: {
            select: { id: true, fullScore: true, publishedAt: true },
          },
        },
      }),
    ]);
  if (!assignment) notFound();
  if (await getModerationRestriction("ASSIGNMENT", assignment.id)) notFound();

  const enrollmentMap = new Map<string, (typeof activeEnrollments)[number]>();
  for (const e of activeEnrollments) enrollmentMap.set(e.id, e);
  for (const e of submittedEnrollments)
    if (!enrollmentMap.has(e.id)) enrollmentMap.set(e.id, e);
  const enrollments = Array.from(enrollmentMap.values());
  const enrollmentIds = enrollments.map((e) => e.id);

  const [submissions, linkedEntries] = await Promise.all([
    db.submission.findMany({
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
    }),
    assignment.scoreItem
      ? db.scoreEntry.findMany({
          where: {
            scoreItemId: assignment.scoreItem.id,
            enrollmentId: { in: enrollmentIds },
          },
          select: { enrollmentId: true, value: true },
        })
      : Promise.resolve([]),
  ]);

  const submissionByEnrollment = new Map(
    submissions.map((s) => [s.enrollmentId, s])
  );
  const valueByEnrollment = new Map(
    linkedEntries.map((e) => [e.enrollmentId, e.value])
  );

  type Row = {
    enrollmentId: string;
    submissionId: string | null;
    name: string;
    studentId: string;
    studentUserId: string;
    hasAvatar: boolean;
    status: SubmissionStatus;
    isLate: boolean;
    submittedAt: Date | null;
    scoreValue: number | null;
    isRemoved: boolean;
  };

  const rows: Row[] = enrollments.map((enr) => {
    const submission = submissionByEnrollment.get(enr.id);
    const current = submission?.versions[0];
    const hasSubmitted = !!current;
    const status: SubmissionStatus =
      hasSubmitted && submission ? submission.status : "NOT_SUBMITTED";
    return {
      enrollmentId: enr.id,
      submissionId: hasSubmitted && submission ? submission.id : null,
      name: `${enr.student.firstName} ${enr.student.lastName}`,
      studentId: enr.student.studentId,
      studentUserId: enr.student.userId,
      hasAvatar: enr.student.user.profileImageId !== null,
      status,
      isLate: current?.isLate ?? false,
      submittedAt: current?.submittedAt ?? null,
      scoreValue: valueByEnrollment.get(enr.id) ?? null,
      isRemoved: enr.removedAt !== null,
    };
  });

  const counts = {
    pending: rows.filter(
      (r) => r.status === "SUBMITTED" || r.status === "LATE_SUBMITTED"
    ).length,
    returned: rows.filter((r) => r.status === "RETURNED").length,
    graded: rows.filter((r) => r.status === "GRADED").length,
    all: rows.length,
  };

  const matchesFilter = (r: Row): boolean => {
    switch (filter) {
      case "pending":
        return r.status === "SUBMITTED" || r.status === "LATE_SUBMITTED";
      case "returned":
        return r.status === "RETURNED";
      case "graded":
        return r.status === "GRADED";
      case "all":
        return true;
    }
  };

  const filteredRows = rows.filter(matchesFilter).sort((a, b) => {
    if (filter === "all") return a.name.localeCompare(b.name, "th");
    const ta = a.submittedAt?.getTime() ?? 0;
    const tb = b.submittedAt?.getTime() ?? 0;
    return filter === "pending" ? ta - tb : tb - ta;
  });

  // Resolve the active submission. `sid` may point at any submission on this
  // assignment (deep link / non-default filter); fall back to the head of the
  // current filtered queue.
  const activeRow =
    (sid ? rows.find((r) => r.submissionId === sid) : undefined) ??
    filteredRows.find((r) => r.submissionId !== null) ??
    null;

  const activeDetail = activeRow?.submissionId
    ? await db.submission.findFirst({
        where: { id: activeRow.submissionId, assignmentId },
        select: {
          id: true,
          status: true,
          versions: {
            orderBy: { versionNumber: "desc" },
            select: {
              id: true,
              versionNumber: true,
              isCurrent: true,
              isLate: true,
              submittedAt: true,
              textContent: true,
              links: true,
              fileAttachmentIds: true,
            },
          },
        },
      })
    : null;

  // Resolve file metadata for every version of the active submission.
  const fileIds = new Set<string>();
  for (const v of activeDetail?.versions ?? [])
    for (const fid of (v.fileAttachmentIds as string[] | null) ?? [])
      fileIds.add(fid);
  const files =
    fileIds.size > 0
      ? await db.fileAttachment.findMany({
          where: { id: { in: Array.from(fileIds) }, deletedAt: null },
          select: {
            id: true,
            originalFilename: true,
            sizeBytes: true,
            mimeType: true,
          },
        })
      : [];
  const fileById = new Map(files.map((f) => [f.id, f]));

  const isScoreItemPublished =
    assignment.scoreItem?.publishedAt !== null &&
    assignment.scoreItem?.publishedAt !== undefined;
  const dueLabel = assignment.dueAt
    ? dueFmt.format(assignment.dueAt)
    : "ส่งเมื่อพร้อม";

  const buildHref = (nextFilter: Filter, nextSid?: string) => {
    const sp = new URLSearchParams();
    sp.set("filter", nextFilter);
    if (nextSid) sp.set("sid", nextSid);
    return `/teacher/courses/${courseId}/assignments/${assignmentId}?${sp.toString()}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Link
        href={`/teacher/courses/${courseId}/assignments`}
        className="inline-flex items-center gap-1 text-xs text-black/50 transition hover:text-black"
      >
        <ChevronLeft className="h-3 w-3" /> กลับไปยังรายการการบ้าน
      </Link>

      {/* Assignment brief — compact header */}
      <div className="card mt-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-black">
              {assignment.title}
            </h1>
            <p className="mt-0.5 text-xs text-black/50">
              กำหนดส่ง: {dueLabel}
              {assignment.isScored && (
                <span className="ml-2 badge badge-info">
                  นับคะแนน · เต็ม {assignment.scoreItem?.fullScore}
                  {isScoreItemPublished && " · เผยแพร่แล้ว"}
                </span>
              )}
            </p>
          </div>
          <div className="rounded-xl bg-black/[0.03] px-3 py-1.5 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wide text-black/45">
              คิวรอตรวจ
            </p>
            <p className="text-lg font-semibold leading-none text-blue-700">
              {counts.pending}
            </p>
          </div>
        </div>
        {assignment.description && (
          <details className="mt-3 text-sm text-black/80">
            <summary className="cursor-pointer text-xs font-medium text-black/55 hover:text-black">
              รายละเอียดโจทย์
            </summary>
            <div className="mt-2 whitespace-pre-wrap leading-relaxed">
              {assignment.description}
            </div>
            {Array.isArray(assignment.linkUrls) &&
              assignment.linkUrls.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {(assignment.linkUrls as string[]).map((href, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <LinkIcon
                        className="h-3 w-3 shrink-0 text-black/40"
                        aria-hidden="true"
                      />
                      <SafeExternalLinkButton
                        href={href}
                        className="truncate rounded-md px-1 py-0.5 text-left text-xs font-medium text-blue-700 underline-offset-2 transition hover:bg-black/[0.04] hover:no-underline"
                      >
                        {href}
                      </SafeExternalLinkButton>
                    </li>
                  ))}
                </ul>
              )}
          </details>
        )}
      </div>

      {enrollments.length === 0 ? (
        <div className="card mt-4 p-10 text-center text-sm text-black/50">
          ยังไม่มีนักเรียนใน CourseOffering นี้
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_320px] lg:items-start">
          {/* LEFT — queue */}
          <aside className="card overflow-hidden p-0 lg:sticky lg:top-24">
            <div className="flex gap-1 overflow-x-auto border-b border-black/5 p-2">
              {FILTER_TABS.map((tab) => {
                const isActive = tab.key === filter;
                return (
                  <Link
                    key={tab.key}
                    href={buildHref(tab.key)}
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                      isActive
                        ? "bg-blue-500 text-white"
                        : "text-black/55 hover:bg-black/[0.04]"
                    }`}
                  >
                    {tab.label}
                    <span
                      className={`ml-1 ${isActive ? "text-white/80" : "text-black/35"}`}
                    >
                      {counts[tab.key]}
                    </span>
                  </Link>
                );
              })}
            </div>

            {filteredRows.length === 0 ? (
              <p className="p-6 text-center text-xs text-black/45">
                {filter === "pending"
                  ? "ไม่มีงานรอตรวจในคิว 🎉"
                  : "ไม่มีรายการในตัวกรองนี้"}
              </p>
            ) : (
              <ul className="max-h-[70vh] divide-y divide-black/5 overflow-y-auto">
                {filteredRows.map((r) => {
                  const isActive =
                    activeRow?.enrollmentId === r.enrollmentId &&
                    activeRow?.submissionId === r.submissionId;
                  const badge = STATUS_LABEL[r.status];
                  const inner = (
                    <>
                      <UserAvatar
                        userId={r.studentUserId}
                        hasImage={r.hasAvatar}
                        size={28}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-black">{r.name}</p>
                        <p className="truncate text-[10px] text-black/40">
                          {r.studentId}
                          {r.submittedAt &&
                            ` · ${dateFmt.format(r.submittedAt)}`}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${badge.color}`}
                      >
                        {badge.label}
                      </span>
                    </>
                  );
                  const cls = `flex w-full items-center gap-2 px-3 py-2.5 text-left transition ${
                    isActive ? "bg-blue-50" : "hover:bg-black/[0.02]"
                  } ${r.isRemoved ? "opacity-60" : ""}`;
                  return (
                    <li key={r.enrollmentId}>
                      {r.submissionId ? (
                        <Link
                          href={buildHref(filter, r.submissionId)}
                          className={cls}
                        >
                          {inner}
                        </Link>
                      ) : (
                        <div className={`${cls} cursor-default`}>{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          {/* CENTER — submitted work */}
          <main className="min-w-0 space-y-4">
            {!activeRow || !activeDetail ? (
              <div className="card grid place-items-center p-12 text-center">
                {filter === "pending" && counts.pending === 0 ? (
                  <div>
                    <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
                    <p className="mt-3 text-sm font-medium text-black">
                      ตรวจครบทุกชิ้นในคิวแล้ว
                    </p>
                    <p className="mt-1 text-xs text-black/50">
                      ไม่มีงานที่รอตรวจสำหรับการบ้านนี้
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-black/50">
                    เลือกนักเรียนจากคิวด้านซ้ายเพื่อดูงานที่ส่ง
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="card p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar
                        userId={activeRow.studentUserId}
                        hasImage={activeRow.hasAvatar}
                        size={40}
                      />
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold text-black">
                          {activeRow.name}
                        </h2>
                        <p className="text-xs text-black/45">
                          เลขประจำตัว {activeRow.studentId}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_LABEL[activeRow.status].color}`}
                    >
                      {STATUS_LABEL[activeRow.status].label}
                    </span>
                  </div>

                  <ul className="mt-4 space-y-3">
                    {activeDetail.versions.map((v) => {
                      const versionFiles = (
                        (v.fileAttachmentIds as string[] | null) ?? []
                      )
                        .map((id) => fileById.get(id))
                        .filter((f): f is NonNullable<typeof f> => !!f);
                      return (
                        <li
                          key={v.id}
                          className={`rounded-xl border p-3 ${
                            v.isCurrent
                              ? "border-green-200 bg-green-50/40"
                              : "border-black/10 bg-black/[0.02]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium text-black">
                              เวอร์ชัน {v.versionNumber}
                              {v.isCurrent && (
                                <span className="ml-2 text-[10px] text-green-700">
                                  (ปัจจุบัน)
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-black/40">
                              {dateFmt.format(v.submittedAt)}
                              {v.isLate && (
                                <span className="ml-2 rounded bg-orange-100 px-1 text-[9px] text-orange-700">
                                  ส่งสาย
                                </span>
                              )}
                            </p>
                          </div>
                          {v.textContent && (
                            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-black/75">
                              {v.textContent}
                            </p>
                          )}
                          {Array.isArray(v.links) && v.links.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {(v.links as string[]).map((href, i) => (
                                <li
                                  key={i}
                                  className="flex items-center gap-1.5"
                                >
                                  <LinkIcon
                                    className="h-3 w-3 shrink-0 text-black/40"
                                    aria-hidden="true"
                                  />
                                  <SafeExternalLinkButton
                                    href={href}
                                    className="truncate rounded-md px-1 py-0.5 text-left text-xs font-medium text-blue-700 underline-offset-2 transition hover:bg-black/[0.04] hover:no-underline"
                                  >
                                    {href}
                                  </SafeExternalLinkButton>
                                </li>
                              ))}
                            </ul>
                          )}
                          {versionFiles.length > 0 && (
                            <SubmissionFilePreview files={versionFiles} />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Submission Conversation — secondary, collapsible */}
                <details className="card p-0">
                  <summary className="flex cursor-pointer items-center gap-2 px-5 py-3 text-sm font-medium text-black/70">
                    <MessageSquare
                      className="h-4 w-4 text-black/40"
                      aria-hidden="true"
                    />
                    ความคิดเห็นส่วนตัว (เฉพาะครูกับนักเรียนคนนี้)
                  </summary>
                  <div className="px-5 pb-5">
                    <CommentsThread
                      ownerType="SUBMISSION"
                      ownerId={activeDetail.id}
                      courseOfferingId={courseId}
                      scope="PRIVATE"
                      session={session}
                      title="ความคิดเห็นส่วนตัว"
                      emptyText="ยังไม่มีข้อความ — ส่งคืนงานพร้อมคำแนะนำเพื่อเริ่มบทสนทนา"
                      revalidatePath={buildHref(filter, activeDetail.id)}
                    />
                  </div>
                </details>
              </>
            )}
          </main>

          {/* RIGHT — review panel */}
          <aside className="lg:sticky lg:top-24">
            {activeRow && activeDetail ? (
              <div className="card p-5">
                <div className="flex items-center gap-2">
                  <FileText
                    className="h-4 w-4 text-black/40"
                    aria-hidden="true"
                  />
                  <h2 className="text-sm font-semibold text-black">ตรวจงาน</h2>
                </div>
                {assignment.isScored && activeRow.scoreValue !== null && (
                  <p className="mt-2 rounded-lg bg-blue-50 px-3 py-1.5 text-xs text-blue-700">
                    คะแนนปัจจุบัน:{" "}
                    <span className="font-semibold">
                      {activeRow.scoreValue}/{assignment.scoreItem?.fullScore}
                    </span>
                  </p>
                )}
                <div className="mt-4">
                  <ReviewPanel
                    courseId={courseId}
                    assignmentId={assignmentId}
                    submissionId={activeDetail.id}
                    isScored={assignment.isScored}
                    fullScore={assignment.scoreItem?.fullScore ?? null}
                    isScoreItemPublished={isScoreItemPublished}
                    currentValue={activeRow.scoreValue}
                  />
                </div>
              </div>
            ) : (
              <div className="card p-5 text-center text-xs text-black/40">
                เลือกงานเพื่อเริ่มตรวจ
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
