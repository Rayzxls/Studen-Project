import { Ban, Check, Clock, FileText, X as XIcon } from "lucide-react";
import type { AttendanceStatus } from "@prisma/client";
import { formatSessionHeader } from "@/lib/attendance/format";
import type {
  StudentAttendanceStats,
  StudentSessionAttendance,
} from "@/lib/attendance/queries";

/**
 * Student-side attendance summary — L1 view (Pattern 4).
 *
 * Server component (no "use client") — receives pre-fetched data from the
 * page. The two queries this consumes (`getAttendanceStatsForStudent`,
 * `getStudentSessionAttendance`) both project at the DB SELECT layer to
 * own-enrollment rows only, so this component cannot leak peer data even
 * if a future refactor passes the result on.
 *
 *   - KPI strip: 4 status counts with semantic colours
 *   - Headline: % present + ratio + "ยังไม่เช็ค" gap
 *   - Per-session timeline: own status per Session, newest first
 */

type StatusBadgeKind = AttendanceStatus | "PENDING" | "CANCELLED";

const STATUS_CHIP: Record<
  StatusBadgeKind,
  { label: string; className: string }
> = {
  PRESENT: {
    label: "มา",
    className: "bg-emerald-100 text-emerald-800 ring-emerald-300",
  },
  LATE: {
    label: "สาย",
    className: "bg-amber-100 text-amber-800 ring-amber-300",
  },
  EXCUSED: {
    label: "ลา",
    className: "bg-blue-100 text-blue-800 ring-blue-300",
  },
  ABSENT: {
    label: "ขาด",
    className: "bg-rose-100 text-rose-800 ring-rose-300",
  },
  PENDING: {
    label: "ยังไม่เช็ค",
    className: "bg-slate-100 text-slate-600 ring-slate-200",
  },
  CANCELLED: {
    label: "ยกเลิก",
    className: "bg-rose-50 text-rose-600 ring-rose-200",
  },
};

function StatusChip({ kind }: { kind: StatusBadgeKind }) {
  const { label, className } = STATUS_CHIP[kind];
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 " +
        className
      }
    >
      {label}
    </span>
  );
}

type Props = {
  stats: StudentAttendanceStats;
  sessions: StudentSessionAttendance[];
};

export function StudentAttendanceStatsView({ stats, sessions }: Props) {
  // Percentage based on PRESENT count over marked Sessions (excludes
  // "ยังไม่เช็ค"). When `marked === 0`, show "—" to avoid 0/0 division.
  const percent =
    stats.marked > 0
      ? Math.round((stats.counts.PRESENT / stats.marked) * 100)
      : null;

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="card p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-xs text-black/50">อัตราการมาเรียน</p>
            <p
              className="mt-1 text-3xl font-medium text-black"
              style={{ letterSpacing: "-0.02em" }}
            >
              {percent !== null ? `${percent}%` : "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-black/50">เช็คชื่อแล้ว</p>
            <p className="mt-1 text-sm font-medium text-black">
              {stats.marked}/{stats.totalSessions} คาบ
            </p>
            {stats.notMarkedYet > 0 && (
              <p className="mt-0.5 text-xs text-black/40">
                ยังไม่เช็ค {stats.notMarkedYet} คาบ
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <CountTile
            icon={<Check className="h-4 w-4 text-emerald-600" />}
            label="มา"
            value={stats.counts.PRESENT}
            tone="emerald"
          />
          <CountTile
            icon={<Clock className="h-4 w-4 text-amber-600" />}
            label="สาย"
            value={stats.counts.LATE}
            tone="amber"
          />
          <CountTile
            icon={<FileText className="h-4 w-4 text-blue-600" />}
            label="ลา"
            value={stats.counts.EXCUSED}
            tone="blue"
          />
          <CountTile
            icon={<XIcon className="h-4 w-4 text-rose-600" />}
            label="ขาด"
            value={stats.counts.ABSENT}
            tone="rose"
          />
        </div>
      </div>

      {/* Per-session timeline */}
      <div className="card p-6">
        <h3
          className="mb-3 text-base font-medium text-black"
          style={{ letterSpacing: "-0.02em" }}
        >
          รายการคาบ
        </h3>
        {sessions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-black/50">
            ยังไม่มีคาบเรียน
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {sessions.map((s) => {
              const cancelled = s.cancelledAt !== null;
              const kind: StatusBadgeKind = cancelled
                ? "CANCELLED"
                : (s.ownStatus ?? "PENDING");
              return (
                <li
                  key={s.sessionId}
                  className={
                    "flex items-center justify-between gap-3 py-3 " +
                    (cancelled ? "opacity-60" : "")
                  }
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-black">
                      {formatSessionHeader(s.scheduledStart, s.scheduledEnd)}
                    </p>
                    {s.note && (
                      <p className="mt-0.5 truncate text-xs text-black/50">
                        {s.note}
                      </p>
                    )}
                    {cancelled && s.cancelledReason && (
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-rose-700/70">
                        <Ban className="h-3 w-3" />
                        {s.cancelledReason}
                      </p>
                    )}
                    {!cancelled && s.ownNote && (
                      <p className="mt-0.5 truncate text-xs text-black/60">
                        บันทึก: {s.ownNote}
                      </p>
                    )}
                  </div>
                  <StatusChip kind={kind} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function CountTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "emerald" | "amber" | "blue" | "rose";
}) {
  const toneRing: Record<typeof tone, string> = {
    emerald: "ring-emerald-200",
    amber: "ring-amber-200",
    blue: "ring-blue-200",
    rose: "ring-rose-200",
  };
  return (
    <div className={"rounded-xl bg-white px-3 py-2.5 ring-1 " + toneRing[tone]}>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xs text-black/60">{label}</span>
      </div>
      <p className="mt-1 text-xl font-medium text-black">{value}</p>
    </div>
  );
}
