import {
  Ban,
  CalendarDays,
  Check,
  Clock,
  FileText,
  Minus,
  X as XIcon,
  type LucideIcon,
} from "lucide-react";
import type { AttendanceStatus } from "@prisma/client";
import { formatTimeRange } from "@/lib/attendance/format";
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
 *   - Headline card: % present + marked ratio + stacked proportion bar
 *   - Count tiles: 4 status counts with semantic colours
 *   - Per-session timeline grouped by month, own status per Session
 */

type StatusBadgeKind = AttendanceStatus | "PENDING" | "CANCELLED";

const STATUS_CHIP: Record<
  StatusBadgeKind,
  { label: string; className: string }
> = {
  PRESENT: {
    label: "มา",
    className: "bg-green-50 text-green-700",
  },
  LATE: {
    label: "สาย",
    className: "bg-orange-50 text-orange-700",
  },
  EXCUSED: {
    label: "ลา",
    className: "bg-blue-50 text-blue-700",
  },
  ABSENT: {
    label: "ขาด",
    className: "bg-red-50 text-red-700",
  },
  PENDING: {
    label: "ยังไม่เช็ค",
    className: "bg-black/[0.05] text-black/60",
  },
  CANCELLED: {
    label: "ยกเลิก",
    className: "bg-red-50 text-red-700",
  },
};

const STATUS_DOT: Record<
  StatusBadgeKind,
  {
    className: string;
    icon: LucideIcon;
  }
> = {
  PRESENT: { className: "bg-green-50 text-green-700", icon: Check },
  LATE: { className: "bg-orange-50 text-orange-700", icon: Clock },
  EXCUSED: { className: "bg-blue-50 text-blue-700", icon: FileText },
  ABSENT: { className: "bg-red-50 text-red-700", icon: XIcon },
  PENDING: { className: "bg-black/[0.04] text-black/40", icon: Minus },
  CANCELLED: { className: "bg-red-50 text-red-700/70", icon: Ban },
};

function StatusChip({ kind }: { kind: StatusBadgeKind }) {
  const { label, className } = STATUS_CHIP[kind];
  return (
    <span
      className={
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium " +
        className
      }
    >
      {label}
    </span>
  );
}

const MONTH_FMT = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  timeZone: "Asia/Bangkok",
  month: "long",
  year: "numeric",
});

const DAY_FMT = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  timeZone: "Asia/Bangkok",
  weekday: "short",
  day: "numeric",
  month: "short",
});

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

  // Proportion segments over marked sessions — the at-a-glance shape of
  // the term. Order mirrors severity: มา → สาย → ลา → ขาด.
  const segments = [
    { key: "PRESENT", count: stats.counts.PRESENT, color: "bg-green-500" },
    { key: "LATE", count: stats.counts.LATE, color: "bg-orange-500" },
    { key: "EXCUSED", count: stats.counts.EXCUSED, color: "bg-blue-500" },
    { key: "ABSENT", count: stats.counts.ABSENT, color: "bg-red-500" },
  ].filter((s) => s.count > 0);

  // Group the timeline by Buddhist-calendar month (Bangkok).
  const monthGroups: { label: string; rows: StudentSessionAttendance[] }[] = [];
  for (const s of sessions) {
    const label = MONTH_FMT.format(s.scheduledStart);
    const last = monthGroups[monthGroups.length - 1];
    if (last && last.label === label) {
      last.rows.push(s);
    } else {
      monthGroups.push({ label, rows: [s] });
    }
  }

  return (
    <div className="space-y-4">
      {/* Headline card */}
      <div className="card p-5 md:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-xs text-black/50">อัตราการมาเรียน</p>
            <p
              className="mt-1 text-3xl font-semibold text-black"
              style={{ letterSpacing: "-0.02em" }}
            >
              {percent !== null ? (
                <>
                  {percent}
                  <span className="ml-1 text-base font-medium text-black/50">
                    %
                  </span>
                </>
              ) : (
                <span className="text-black/30">—</span>
              )}
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

        {/* Stacked proportion bar — one glance shows the term's shape. */}
        {stats.marked > 0 && (
          <div
            className="mt-4 flex h-2.5 w-full gap-px overflow-hidden rounded-full bg-black/[0.05]"
            role="img"
            aria-label={`มา ${stats.counts.PRESENT} สาย ${stats.counts.LATE} ลา ${stats.counts.EXCUSED} ขาด ${stats.counts.ABSENT} จากที่เช็คแล้ว ${stats.marked} คาบ`}
          >
            {segments.map((seg) => (
              <span
                key={seg.key}
                className={`h-full ${seg.color}`}
                style={{ width: `${(seg.count / stats.marked) * 100}%` }}
              />
            ))}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <CountTile
            icon={<Check className="h-4 w-4 text-green-700" />}
            label="มา"
            value={stats.counts.PRESENT}
            tint="bg-green-50 text-green-700"
          />
          <CountTile
            icon={<Clock className="h-4 w-4 text-orange-700" />}
            label="สาย"
            value={stats.counts.LATE}
            tint="bg-orange-50 text-orange-700"
          />
          <CountTile
            icon={<FileText className="h-4 w-4 text-blue-700" />}
            label="ลา"
            value={stats.counts.EXCUSED}
            tint="bg-blue-50 text-blue-700"
          />
          <CountTile
            icon={<XIcon className="h-4 w-4 text-red-700" />}
            label="ขาด"
            value={stats.counts.ABSENT}
            tint="bg-red-50 text-red-700"
          />
        </div>
      </div>

      {/* Per-session timeline, grouped by month */}
      <div className="card p-5 md:p-6">
        <header className="flex items-baseline justify-between gap-3">
          <h3
            className="text-base font-medium text-black"
            style={{ letterSpacing: "-0.02em" }}
          >
            รายการคาบ
          </h3>
          {sessions.length > 0 && (
            <span className="text-xs text-black/50">{sessions.length} คาบ</span>
          )}
        </header>

        {sessions.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-black/15 p-8 text-center">
            <CalendarDays
              className="mx-auto h-7 w-7 text-black/25"
              aria-hidden="true"
            />
            <p className="mt-3 text-sm font-medium text-black">
              ยังไม่มีคาบเรียน
            </p>
            <p className="mt-1 text-xs text-black/50">
              เมื่อครูเปิดคาบและเช็คชื่อ ประวัติของเราจะปรากฏที่นี่
            </p>
          </div>
        ) : (
          <div className="mt-2 space-y-4">
            {monthGroups.map((group) => (
              <section key={group.label}>
                <h4 className="sticky top-0 py-1 text-xs font-medium text-black/50">
                  {group.label}
                </h4>
                <ul className="divide-y divide-black/5">
                  {group.rows.map((s) => {
                    const cancelled = s.cancelledAt !== null;
                    const kind: StatusBadgeKind = cancelled
                      ? "CANCELLED"
                      : (s.ownStatus ?? "PENDING");
                    const dot = STATUS_DOT[kind];
                    const DotIcon = dot.icon;
                    return (
                      <li
                        key={s.sessionId}
                        className={
                          "flex min-h-11 items-center gap-3 py-2.5 " +
                          (cancelled ? "opacity-60" : "")
                        }
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${dot.className}`}
                        >
                          <DotIcon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-black">
                            {DAY_FMT.format(s.scheduledStart)}
                            <span className="ml-1.5 font-normal text-black/50">
                              {formatTimeRange(
                                s.scheduledStart,
                                s.scheduledEnd
                              )}
                            </span>
                          </p>
                          {s.note && (
                            <p className="mt-0.5 truncate text-xs text-black/50">
                              {s.note}
                            </p>
                          )}
                          {cancelled && s.cancelledReason && (
                            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-red-700/70">
                              <Ban className="h-3 w-3" aria-hidden="true" />
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
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CountTile({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tint: string;
}) {
  return (
    <div className={`rounded-xl px-3 py-2.5 ${tint}`}>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xs font-medium opacity-80">{label}</span>
      </div>
      <p
        className="mt-1 text-xl font-semibold"
        style={{ letterSpacing: "-0.01em" }}
      >
        {value}
      </p>
    </div>
  );
}
