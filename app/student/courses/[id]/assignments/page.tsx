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
import { studentCourseTabs } from "../_tabs";

/**
 * Student Assignments tab — Phase 6 · P6-6, Phase 11 visual upgrade.
 *
 * Splits the flat list into a mobile-first workspace:
 *   - summary strip (ต้องส่ง / ส่งแล้ว / ตรวจแล้ว) tinted by status
 *   - "ต้องส่ง" section sorted by due date (closest first, no-due last)
 *   - "เสร็จแล้ว" section (submitted / late / graded), newest first
 *   - per-row status icon circle + due-countdown chip
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
  {
    label: string;
    badge: string;
    iconBg: string;
    icon: LucideIcon;
  }
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

/** Coarse time-based countdown — enough precision for a due chip. */
function dueChip(
  dueAt: Date | null,
  nowMs: number,
  isDone: boolean
): { label: string; className: string } | null {
  if (dueAt === null || isDone) return null;
  const diffMs = dueAt.getTime() - nowMs;
  if (diffMs < 0) {
    return {
      label: "เลยกำหนด",
      className: "bg-red-50 text-red-700",
    };
  }
  const days = Math.floor(diffMs / 86_400_000);
  if (days === 0) {
    return {
      label: "ครบกำหนดวันนี้",
      className: "bg-orange-50 text-orange-700",
    };
  }
  if (days === 1) {
    return { label: "พรุ่งนี้", className: "bg-orange-50 text-orange-700" };
  }
  if (days <= 7) {
    return {
      label: `เหลืออีก ${days} วัน`,
      className: "bg-black/[0.05] text-black/60",
    };
  }
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

  const withStatus = assignments.map((a) => {
    const status: StatusKey = (a.submissions[0]?.status ??
      "NOT_SUBMITTED") as StatusKey;
    return { ...a, status };
  });

  // ต้องส่ง — closest due first, no-due last (createdAt DESC preserved).
  const todo = withStatus
    .filter((a) => TODO_STATUSES.has(a.status))
    .sort((a, b) => {
      if (a.dueAt === null && b.dueAt === null) return 0;
      if (a.dueAt === null) return 1;
      if (b.dueAt === null) return -1;
      return a.dueAt.getTime() - b.dueAt.getTime();
    });
  const done = withStatus.filter((a) => !TODO_STATUSES.has(a.status));

  const gradedCount = done.filter((a) => a.status === "GRADED").length;
  const submittedCount = done.length;

  return (
    <CourseShell
      session={session}
      course={course}
      eyebrow="วิชาที่เรียน"
      backHref="/dashboard"
      tabs={studentCourseTabs(id)}
    >
      <div className="space-y-4">
        {/* Summary strip — same tinted-KPI idiom as the Overview tab. */}
        <div className="grid grid-cols-3 gap-2 md:gap-4">
          <SummaryTile
            label="ต้องส่ง"
            value={todo.length}
            tone={todo.length > 0 ? "orange" : "green"}
            icon={<ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />}
          />
          <SummaryTile
            label="ส่งแล้ว"
            value={submittedCount}
            tone={submittedCount > 0 ? "green" : "neutral"}
            icon={<Send className="h-3.5 w-3.5" aria-hidden="true" />}
          />
          <SummaryTile
            label="ตรวจแล้ว"
            value={gradedCount}
            tone={gradedCount > 0 ? "blue" : "neutral"}
            icon={<GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />}
          />
        </div>

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
            {/* ต้องส่ง */}
            <section className="card p-5 md:p-6">
              <header className="flex items-baseline justify-between gap-3">
                <h2
                  className="text-base font-medium text-black"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  ต้องส่ง
                </h2>
                <span className="text-xs text-black/50">
                  {todo.length === 0 ? "ไม่มีงานค้าง" : `${todo.length} รายการ`}
                </span>
              </header>

              {todo.length === 0 ? (
                <div className="mt-3 flex items-center gap-3 rounded-xl bg-green-50 px-4 py-3">
                  <CheckCircle2
                    className="h-5 w-5 shrink-0 text-green-700"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-green-700">
                    ส่งงานครบทุกรายการแล้ว เยี่ยมมาก
                  </p>
                </div>
              ) : (
                <ul className="mt-2 divide-y divide-black/5">
                  {todo.map((a) => (
                    <AssignmentRow
                      key={a.id}
                      courseId={id}
                      assignment={a}
                      nowMs={renderNow}
                    />
                  ))}
                </ul>
              )}
            </section>

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
  const chip = dueChip(assignment.dueAt, nowMs, isDone);
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
