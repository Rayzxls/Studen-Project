import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  GraduationCap,
  PencilLine,
  RotateCcw,
  Send,
  type LucideIcon,
} from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { CourseShell } from "@/components/course/course-shell";
import { DueCountdown } from "@/components/assignment/due-countdown";
import {
  AssignmentTimeline,
  type TimelineItem,
} from "@/components/assignment/assignment-timeline";
import { WorkloadHeatmap } from "@/components/assignment/workload-heatmap";
import { FocusMode, type FocusItem } from "@/components/assignment/focus-mode";
import { studentCourseTabs } from "../_tabs";

/**
 * Student Assignments tab — Phase 12 "งาน cockpit".
 *
 * A mobile-first work cockpit rather than a flat list:
 *   - live countdown hero for the single most urgent pending assignment
 *   - due-date timeline plotting every dated assignment
 *   - summary strip (ต้องส่ง / ส่งแล้ว / ตรวจแล้ว)
 *   - auto-planned pending groups (เลยกำหนด / วันนี้ / สัปดาห์นี้ / ภายหลัง /
 *     ไม่มีกำหนด), then a "เสร็จแล้ว" section
 *
 * The L1 boundary: a student NEVER sees other students' submissions or
 * counts. Only own Submission row joins.
 */

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

type StatusKey =
  | "NOT_SUBMITTED"
  | "DRAFT"
  | "SUBMITTED"
  | "LATE_SUBMITTED"
  | "RETURNED"
  | "GRADED";

const STATUS_META: Record<
  StatusKey,
  { label: string; badge: string; iconBg: string; icon: LucideIcon }
> = {
  NOT_SUBMITTED: {
    label: "ยังไม่ส่ง",
    badge: "bg-black/[0.05] text-black/60",
    iconBg: "bg-black/[0.04] text-black/50",
    icon: ClipboardList,
  },
  DRAFT: {
    label: "ร่าง",
    badge: "bg-black/[0.05] text-black/60",
    iconBg: "bg-black/[0.04] text-black/60",
    icon: PencilLine,
  },
  RETURNED: {
    label: "ส่งคืน",
    badge: "bg-red-50 text-red-700",
    iconBg: "bg-red-50 text-red-700",
    icon: RotateCcw,
  },
  SUBMITTED: {
    label: "ส่งแล้ว",
    badge: "bg-green-50 text-green-700",
    iconBg: "bg-green-50 text-green-700",
    icon: Send,
  },
  LATE_SUBMITTED: {
    label: "ส่งสาย",
    badge: "bg-orange-50 text-orange-700",
    iconBg: "bg-orange-50 text-orange-700",
    icon: Clock,
  },
  GRADED: {
    label: "ตรวจแล้ว",
    badge: "bg-blue-50 text-blue-700",
    iconBg: "bg-blue-50 text-blue-700",
    icon: GraduationCap,
  },
};

const TODO_STATUSES: ReadonlySet<StatusKey> = new Set([
  "NOT_SUBMITTED",
  "DRAFT",
  "RETURNED",
]);

const DUE_FMT = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  timeZone: "Asia/Bangkok",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const BKK_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

type Bucket = "overdue" | "today" | "week" | "later" | "none";

const BUCKET_RANK: Record<Bucket, number> = {
  overdue: 1,
  today: 2,
  week: 3,
  later: 4,
  none: 5,
};

const PLAN_GROUPS: { key: Bucket; label: string }[] = [
  { key: "overdue", label: "เลยกำหนด" },
  { key: "today", label: "ครบกำหนดวันนี้" },
  { key: "week", label: "ภายในสัปดาห์นี้" },
  { key: "later", label: "ภายหลัง" },
  { key: "none", label: "ไม่มีกำหนดส่ง" },
];

function bucketOf(dueAt: Date | null, nowMs: number, todayStr: string): Bucket {
  if (dueAt === null) return "none";
  if (dueAt.getTime() < nowMs) return "overdue";
  if (BKK_DAY.format(dueAt) === todayStr) return "today";
  if (dueAt.getTime() - nowMs <= 7 * 86_400_000) return "week";
  return "later";
}

/** Coarse due chip for a pending row. */
function dueChip(
  dueAt: Date | null,
  nowMs: number
): { label: string; className: string } | null {
  if (dueAt === null) return null;
  const diffMs = dueAt.getTime() - nowMs;
  if (diffMs < 0)
    return { label: "เลยกำหนด", className: "bg-red-50 text-red-700" };
  const days = Math.floor(diffMs / 86_400_000);
  if (days === 0)
    return {
      label: "ครบกำหนดวันนี้",
      className: "bg-orange-50 text-orange-700",
    };
  if (days === 1)
    return { label: "พรุ่งนี้", className: "bg-orange-50 text-orange-700" };
  if (days <= 7)
    return {
      label: `เหลืออีก ${days} วัน`,
      className: "bg-black/[0.05] text-black/60",
    };
  return null;
}

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
      class: { select: { id: true, name: true } },
      term: { select: { name: true } },
      teacher: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          user: { select: { profileImageId: true } },
        },
      },
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
  const todayStr = BKK_DAY.format(new Date(renderNow));

  const withStatus = assignments.map((a) => ({
    ...a,
    status: (a.submissions[0]?.status ?? "NOT_SUBMITTED") as StatusKey,
  }));

  const pending = withStatus.filter((a) => TODO_STATUSES.has(a.status));
  const done = withStatus.filter((a) => !TODO_STATUSES.has(a.status));

  // ── Hero: single most urgent pending item ─────────────────────
  // RETURNED (must fix) first, then by due bucket, then soonest due.
  const heroRank = (a: (typeof pending)[number]) =>
    a.status === "RETURNED"
      ? 0
      : BUCKET_RANK[bucketOf(a.dueAt, renderNow, todayStr)];
  const pendingSorted = [...pending].sort((a, b) => {
    const r = heroRank(a) - heroRank(b);
    if (r !== 0) return r;
    if (a.dueAt && b.dueAt) return a.dueAt.getTime() - b.dueAt.getTime();
    if (a.dueAt) return -1;
    if (b.dueAt) return 1;
    return 0;
  });
  const heroItem = pendingSorted[0] ?? null;

  // ── Timeline: every dated assignment ──────────────────────────
  const timelineItems: TimelineItem[] = withStatus
    .filter((a) => a.dueAt !== null)
    .map((a) => {
      const isDone = !TODO_STATUSES.has(a.status);
      const b = bucketOf(a.dueAt, renderNow, todayStr);
      const soon =
        a.dueAt !== null && a.dueAt.getTime() - renderNow <= 2 * 86_400_000;
      const tone: TimelineItem["tone"] = isDone
        ? "done"
        : b === "overdue"
          ? "overdue"
          : b === "today" || soon
            ? "soon"
            : "future";
      return {
        id: a.id,
        title: a.title,
        href: `/student/courses/${id}/assignments/${a.id}`,
        dueMs: a.dueAt!.getTime(),
        tone,
        isNext: heroItem !== null && a.id === heroItem.id,
        dueLabel: DUE_FMT.format(a.dueAt!),
      };
    });

  // ── Auto-plan groups (hero excluded to avoid showing it twice) ─
  const groupedPending = pending.filter((a) => a.id !== heroItem?.id);
  const planSections = PLAN_GROUPS.map((g) => ({
    ...g,
    rows: groupedPending
      .filter((a) => bucketOf(a.dueAt, renderNow, todayStr) === g.key)
      .sort((a, b) => {
        if (a.dueAt && b.dueAt) return a.dueAt.getTime() - b.dueAt.getTime();
        if (a.dueAt) return -1;
        if (b.dueAt) return 1;
        return 0;
      }),
  })).filter((g) => g.rows.length > 0);

  const gradedCount = done.filter((a) => a.status === "GRADED").length;

  // ── Workload heatmap (pending due dates) + focus queue ─────────
  const heatmapDueDates = pending
    .filter((a) => a.dueAt !== null)
    .map((a) => a.dueAt!.getTime());
  const focusItems: FocusItem[] = pendingSorted.map((a) => {
    const chip = dueChip(a.dueAt, renderNow);
    return {
      id: a.id,
      title: a.title,
      href: `/student/courses/${id}/assignments/${a.id}`,
      dueLabel: a.dueAt
        ? `กำหนดส่ง ${DUE_FMT.format(a.dueAt)}`
        : "ส่งเมื่อพร้อม",
      statusLabel: STATUS_META[a.status].label,
      statusClass: STATUS_META[a.status].badge,
      note: chip ? chip.label : null,
    };
  });

  const heroNote =
    heroItem === null
      ? ""
      : heroItem.status === "RETURNED"
        ? "อ่านคำแนะนำจากครู แล้วส่งใหม่"
        : heroItem.status === "DRAFT"
          ? "มีร่างค้างอยู่ ทำต่อได้เลย"
          : heroItem.dueAt === null
            ? "ส่งเมื่อพร้อม"
            : `กำหนดส่ง ${DUE_FMT.format(heroItem.dueAt)}`;

  return (
    <CourseShell
      session={session}
      course={course}
      eyebrow="วิชาที่เรียน"
      backHref="/dashboard"
      tabs={studentCourseTabs(id)}
    >
      <div className="space-y-4">
        {assignments.length === 0 ? (
          <div className="card p-6">
            <div className="rounded-xl border border-dashed border-black/15 p-10 text-center">
              <FileText className="mx-auto h-8 w-8 text-black/25" />
              <p className="mt-3 text-sm font-medium text-black">
                ยังไม่มีการบ้านในวิชานี้
              </p>
              <p className="mt-1 text-xs text-black/50">
                เมื่อครูมอบหมายงาน รายการจะปรากฏที่นี่พร้อมกำหนดส่ง
              </p>
            </div>
          </div>
        ) : (
          <>
            {heroItem ? (
              <DueCountdown
                title={heroItem.title}
                href={`/student/courses/${id}/assignments/${heroItem.id}`}
                dueAtISO={heroItem.dueAt ? heroItem.dueAt.toISOString() : null}
                note={heroNote}
                isReturned={heroItem.status === "RETURNED"}
              />
            ) : (
              <div className="card-tinted card-tinted-green flex items-center gap-3 p-5">
                <CheckCircle2
                  className="h-6 w-6 shrink-0 text-green-700"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-medium text-green-700">
                    ส่งงานครบทุกรายการแล้ว
                  </p>
                  <p className="text-xs text-green-700/80">
                    เยี่ยมมาก ไม่มีงานค้างในวิชานี้
                  </p>
                </div>
              </div>
            )}

            <AssignmentTimeline items={timelineItems} nowMs={renderNow} />

            <WorkloadHeatmap dueDates={heatmapDueDates} nowMs={renderNow} />

            {/* Summary strip */}
            <div className="grid grid-cols-3 gap-2 md:gap-4">
              <SummaryTile
                label="ต้องส่ง"
                value={pending.length}
                tone={pending.length > 0 ? "orange" : "green"}
                icon={
                  <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
                }
              />
              <SummaryTile
                label="ส่งแล้ว"
                value={done.length}
                tone={done.length > 0 ? "green" : "neutral"}
                icon={<Send className="h-3.5 w-3.5" aria-hidden="true" />}
              />
              <SummaryTile
                label="ตรวจแล้ว"
                value={gradedCount}
                tone={gradedCount > 0 ? "blue" : "neutral"}
                icon={
                  <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
                }
              />
            </div>

            <FocusMode items={focusItems} />

            {/* Auto-planned pending groups */}
            {planSections.map((g) => (
              <section key={g.key} className="card p-5 md:p-6">
                <header className="flex items-baseline justify-between gap-3">
                  <h2
                    className="text-base font-medium text-black"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    {g.label}
                  </h2>
                  <span className="text-xs text-black/50">
                    {g.rows.length} รายการ
                  </span>
                </header>
                <ul className="mt-2 divide-y divide-black/5">
                  {g.rows.map((a) => (
                    <AssignmentRow
                      key={a.id}
                      courseId={id}
                      assignment={a}
                      nowMs={renderNow}
                    />
                  ))}
                </ul>
              </section>
            ))}

            {/* เสร็จแล้ว */}
            {done.length > 0 && (
              <section className="card p-5 md:p-6">
                <header className="flex items-baseline justify-between gap-3">
                  <h2
                    className="text-base font-medium text-black"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    เสร็จแล้ว
                  </h2>
                  <span className="text-xs text-black/50">
                    {done.length} รายการ
                  </span>
                </header>
                <ul className="mt-2 divide-y divide-black/5">
                  {done.map((a) => (
                    <AssignmentRow
                      key={a.id}
                      courseId={id}
                      assignment={a}
                      nowMs={renderNow}
                    />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </CourseShell>
  );
}

function SummaryTile({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: "blue" | "green" | "orange" | "neutral";
  icon: React.ReactNode;
}) {
  const toneClass =
    tone === "neutral" ? "card" : `card-tinted card-tinted-${tone}`;
  return (
    <div className={`${toneClass} p-3.5 md:p-5`}>
      <p className="flex items-center gap-1.5 text-[11px] font-medium opacity-80 md:text-xs">
        {icon}
        {label}
      </p>
      <p
        className="mt-1.5 text-2xl font-semibold md:text-3xl"
        style={{ letterSpacing: "-0.02em" }}
      >
        {value}
      </p>
    </div>
  );
}

function AssignmentRow({
  courseId,
  assignment,
  nowMs,
}: {
  courseId: string;
  assignment: {
    id: string;
    title: string;
    dueAt: Date | null;
    isScored: boolean;
    status: StatusKey;
  };
  nowMs: number;
}) {
  const meta = STATUS_META[assignment.status];
  const Icon = meta.icon;
  const isDone = !TODO_STATUSES.has(assignment.status);
  const chip = isDone ? null : dueChip(assignment.dueAt, nowMs);
  const isOverdue =
    !isDone && assignment.dueAt !== null && assignment.dueAt.getTime() < nowMs;
  const dueLabel = assignment.dueAt
    ? DUE_FMT.format(assignment.dueAt)
    : "ส่งเมื่อพร้อม";

  return (
    <li>
      <Link
        href={`/student/courses/${courseId}/assignments/${assignment.id}`}
        className="-mx-2 flex min-h-11 items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-black/[0.025] hover:no-underline"
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.iconBg}`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="truncate text-sm font-medium text-black">
              {assignment.title}
            </span>
            {assignment.isScored && (
              <span className="badge-info shrink-0">นับคะแนน</span>
            )}
          </span>
          <span
            className={`mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs ${
              isOverdue ? "text-red-700" : "text-black/50"
            }`}
          >
            กำหนดส่ง: {dueLabel}
            {chip && (
              <span
                className={`inline-flex rounded-full px-2 py-px text-[10px] font-medium ${chip.className}`}
              >
                {chip.label}
              </span>
            )}
          </span>
        </span>
        <span
          className={`shrink-0 self-center rounded-full px-2.5 py-0.5 text-[10px] font-medium ${meta.badge}`}
        >
          {meta.label}
        </span>
      </Link>
    </li>
  );
}
