import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Inbox,
  MapPin,
} from "lucide-react";
import { AnimatedStat } from "@/components/dashboard/animated-stat";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForStudent } from "@/lib/course/queries";
import { db } from "@/lib/db/client";
import { CourseShell } from "@/components/course/course-shell";
import { LeaveCourseDialog } from "@/components/course/leave-course-dialog";
import { studentCourseTabs } from "../_tabs";
import { getAttendanceStatsForStudent } from "@/lib/attendance/queries";
import { listTimetableSlots } from "@/lib/attendance/timetable";
import { dayOfWeekShort } from "@/lib/attendance/format";
import { getOwnScoresForStudent } from "@/lib/scoring/queries";
import { scoreTotal } from "@/lib/scoring/calc";
import { formatPercent } from "@/lib/scoring/format";
import {
  buildFeedRowPreview,
  resolveFeedHref,
  type FeedItem,
} from "@/lib/feed";
import { NotificationIcon } from "@/components/notification/bell-icon";
import { RelativeTime } from "@/components/notification/relative-time";

// Auth-gated DB-fetching page — skip static prerender.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

const RECENT_LIMIT = 5;

export default async function StudentCourseOverviewPage({ params }: PageProps) {
  let session;
  try {
    session = await requireRole(["STUDENT"]);
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;
  // L1 gate — returns null if student has no active enrollment.
  const course = await getCourseOfferingForStudent(id, session.user.id);
  if (!course) notFound();

  // Run the per-course aggregations in parallel.
  const [
    slots,
    stats,
    scoreResult,
    pendingAssignmentCount,
    recentAssignments,
    recentMaterials,
    recentAnnouncements,
    recentScoreItems,
  ] = await Promise.all([
    listTimetableSlots(id),
    getAttendanceStatsForStudent({
      courseOfferingId: id,
      studentUserId: session.user.id,
    }),
    getOwnScoresForStudent(id, session.user.id),
    db.assignment.count({
      where: {
        courseOfferingId: id,
        OR: [
          {
            submissions: {
              none: { enrollment: { studentId: session.user.id } },
            },
          },
          {
            submissions: {
              some: {
                enrollment: { studentId: session.user.id },
                status: { in: ["DRAFT", "RETURNED"] },
              },
            },
          },
        ],
      },
    }),
    db.assignment.findMany({
      where: { courseOfferingId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: RECENT_LIMIT,
      select: {
        id: true,
        courseOfferingId: true,
        title: true,
        dueAt: true,
        createdAt: true,
      },
    }),
    db.material.findMany({
      where: { courseOfferingId: id, deletedAt: null },
      orderBy: [{ postedAt: "desc" }, { id: "desc" }],
      take: RECENT_LIMIT,
      select: {
        id: true,
        courseOfferingId: true,
        title: true,
        postedAt: true,
      },
    }),
    db.announcement.findMany({
      where: { courseOfferingId: id, deletedAt: null },
      orderBy: [{ postedAt: "desc" }, { id: "desc" }],
      take: RECENT_LIMIT,
      select: {
        id: true,
        courseOfferingId: true,
        title: true,
        postedAt: true,
      },
    }),
    db.scoreItem.findMany({
      where: { courseOfferingId: id, publishedAt: { not: null } },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: RECENT_LIMIT,
      select: {
        id: true,
        courseOfferingId: true,
        name: true,
        publishedAt: true,
      },
    }),
  ]);

  // ── Attendance KPI ────────────────────────────────────────────
  const attendedCount =
    (stats?.counts.PRESENT ?? 0) + (stats?.counts.LATE ?? 0);
  const attendanceRate =
    stats && stats.marked > 0
      ? Math.round((attendedCount / stats.marked) * 100)
      : null;

  // ── Score-total preview (published items, own values) — ADR-0024 ──
  const calcItems = scoreResult.items.map((it) => ({
    id: it.id,
    fullScore: it.fullScore,
    publishedAt: it.publishedAt,
  }));
  const calcEntries = scoreResult.items
    .filter((it) => it.myValue !== null)
    .map((it) => ({ scoreItemId: it.id, value: it.myValue as number }));
  const percent = scoreTotal(calcItems, calcEntries);
  const lockedItems = scoreResult.totalItems - scoreResult.publishedItems;

  // ── Recent activity merged & sliced ───────────────────────────
  const merged: FeedItem[] = [
    ...recentAssignments.map(
      (a): FeedItem => ({
        kind: "ASSIGNMENT",
        id: a.id,
        courseOfferingId: a.courseOfferingId,
        sortAt: a.createdAt,
        title: a.title,
        detail: a.dueAt ? a.dueAt.toISOString() : null,
      })
    ),
    ...recentMaterials.map(
      (m): FeedItem => ({
        kind: "MATERIAL",
        id: m.id,
        courseOfferingId: m.courseOfferingId,
        sortAt: m.postedAt,
        title: m.title,
      })
    ),
    ...recentAnnouncements.map(
      (an): FeedItem => ({
        kind: "ANNOUNCEMENT",
        id: an.id,
        courseOfferingId: an.courseOfferingId,
        sortAt: an.postedAt,
        title: an.title,
      })
    ),
    ...recentScoreItems.map(
      (s): FeedItem => ({
        kind: "SCORE_PUBLISHED",
        id: s.id,
        courseOfferingId: s.courseOfferingId,
        sortAt: s.publishedAt!,
        title: s.name,
      })
    ),
  ];
  merged.sort((a, b) => {
    const t = b.sortAt.getTime() - a.sortAt.getTime();
    if (t !== 0) return t;
    return b.id.localeCompare(a.id);
  });
  const recent = merged.slice(0, RECENT_LIMIT);

  // ── Current / next timetable slot (Asia/Bangkok wall clock) ───
  const highlightedSlot = findHighlightedSlot(slots);

  return (
    <CourseShell
      session={session}
      course={course}
      eyebrow="ห้องเรียน"
      backHref="/dashboard"
      tabs={studentCourseTabs(id)}
    >
      <div className="space-y-6">
        {/* 1) Class info card — weekly timetable with the current / next
            slot highlighted so the card answers "เรียนคาบต่อไปเมื่อไหร่"
            at a glance. */}
        <div className="card p-5 md:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2
              className="flex items-center gap-2 text-base font-medium text-black"
              style={{ letterSpacing: "-0.01em" }}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <CalendarClock className="h-4 w-4" aria-hidden="true" />
              </span>
              ตารางเรียน
            </h2>
            {slots.length > 0 && (
              <span className="text-xs text-black/50">
                {slots.length} คาบ/สัปดาห์
              </span>
            )}
          </div>
          {slots.length === 0 ? (
            <p className="mt-3 text-sm text-black/50">
              ครูยังไม่ได้ตั้งตารางเรียนประจำสัปดาห์
            </p>
          ) : (
            <ul className="mt-3 space-y-1 text-sm text-black/80">
              {slots.map((s) => {
                const highlight =
                  highlightedSlot !== null && s.id === highlightedSlot.id;
                return (
                  <li
                    key={s.id}
                    className={
                      "-mx-2 flex min-h-9 flex-wrap items-center gap-2 rounded-xl px-2 py-1.5 " +
                      (highlight ? "bg-blue-50" : "")
                    }
                  >
                    <span
                      className={
                        "inline-flex h-6 w-9 items-center justify-center rounded text-xs font-medium " +
                        (highlight
                          ? "bg-blue-500 text-white"
                          : "bg-black/[0.04] text-black/70")
                      }
                    >
                      {dayOfWeekShort(s.dayOfWeek)}
                    </span>
                    <span
                      className={
                        "font-mono text-xs " +
                        (highlight ? "text-blue-700" : "text-black")
                      }
                    >
                      {s.startTime}–{s.endTime}
                    </span>
                    {s.location && (
                      <span
                        className={
                          "inline-flex items-center gap-0.5 text-xs " +
                          (highlight ? "text-blue-700/80" : "text-black/60")
                        }
                      >
                        <MapPin className="h-3 w-3" aria-hidden="true" />
                        {s.location}
                      </span>
                    )}
                    {highlight && (
                      <span className="ml-auto inline-flex rounded-full bg-blue-500 px-2 py-px text-[10px] font-medium text-white">
                        {highlightedSlot.kind === "now"
                          ? "กำลังเรียน"
                          : "คาบถัดไป"}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 2) My status — KPI row. Each card is .card-tinted variant by
            status semantic: attendance green when high, orange mid, red
            low; scores blue; pending green when 0 / orange when > 0.
            Numbers animate via AnimatedStat. */}
        <div className="grid gap-4 md:grid-cols-3">
          <AttendanceKpi
            id={id}
            attendanceRate={attendanceRate}
            marked={stats?.marked ?? null}
            totalSessions={stats?.totalSessions ?? null}
          />
          <ScoreKpi
            id={id}
            percent={percent}
            publishedItems={scoreResult.publishedItems}
            totalItems={scoreResult.totalItems}
            lockedItems={lockedItems}
          />
          <PendingKpi id={id} pending={pendingAssignmentCount} />
        </div>

        {/* 3) Recent activity */}
        <section className="card-flat p-1">
          <div className="px-5 pt-4">
            <h2
              className="text-base font-medium text-black"
              style={{ letterSpacing: "-0.01em" }}
            >
              กิจกรรมล่าสุดในวิชานี้
            </h2>
            <p className="mt-0.5 text-xs text-black/50">
              ประกาศ การบ้าน เอกสาร และคะแนนที่เพิ่งเผยแพร่
            </p>
          </div>

          {recent.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <Inbox
                className="mb-3 h-8 w-8 text-black/20"
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-black">ยังไม่มีกิจกรรม</p>
              <p className="mt-1 text-xs text-black/50">
                ประกาศ การบ้าน และเอกสารใหม่จะปรากฏที่นี่
              </p>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-black/[0.04]">
              {recent.map((item) => {
                const preview = buildFeedRowPreview({
                  item,
                  courseName: "",
                });
                const href = resolveFeedHref({
                  kind: item.kind,
                  courseOfferingId: item.courseOfferingId,
                  itemId: item.id,
                });
                return (
                  <li key={`${item.kind}-${item.id}`}>
                    <Link
                      href={href}
                      className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-black/[0.025] hover:no-underline"
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-black/70">
                        <NotificationIcon
                          iconKey={preview.iconKey}
                          className="h-4 w-4"
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-black">
                          {preview.bold}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-black/50">
                          {preview.meta && (
                            <>
                              <span className="truncate">{preview.meta}</span>
                              <span aria-hidden="true">·</span>
                            </>
                          )}
                          <span className="shrink-0">
                            <RelativeTime iso={item.sortAt.toISOString()} />
                          </span>
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <LeaveCourseDialog courseId={id} courseName={course.name} />
      </div>
    </CourseShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Timetable highlight — current or next weekly slot
// ─────────────────────────────────────────────────────────────

type TimetableSlotRow = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location: string | null;
};

/**
 * Pick the slot to highlight: the slot in progress right now (Bangkok wall
 * clock), else the nearest upcoming slot in the weekly cycle. Pure over
 * the injected slot list; reads the clock once per render.
 */
function findHighlightedSlot(
  slots: TimetableSlotRow[]
): { id: string; kind: "now" | "next" } | null {
  if (slots.length === 0) return null;

  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const dowMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const nowDow = dowMap[weekday];
  if (nowDow === undefined) return null;
  const nowMinutes = Number(hour) * 60 + Number(minute);

  const toMinutes = (t: string): number => {
    const [h, m] = t.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };

  // In progress right now?
  const current = slots.find(
    (s) =>
      s.dayOfWeek === nowDow &&
      toMinutes(s.startTime) <= nowMinutes &&
      nowMinutes < toMinutes(s.endTime)
  );
  if (current) return { id: current.id, kind: "now" };

  // Nearest upcoming occurrence in the 7-day cycle.
  let best: { id: string; delta: number } | null = null;
  for (const s of slots) {
    const dayDelta = (s.dayOfWeek - nowDow + 7) % 7;
    let delta = dayDelta * 1440 + (toMinutes(s.startTime) - nowMinutes);
    if (delta <= 0) delta += 7 * 1440; // already passed today → next week
    if (best === null || delta < best.delta) {
      best = { id: s.id, delta };
    }
  }
  return best ? { id: best.id, kind: "next" } : null;
}

// ─────────────────────────────────────────────────────────────
// KPI tile components — .card-tinted variants tinted by status
// ─────────────────────────────────────────────────────────────

function kpiToneClass(
  tone: "blue" | "green" | "orange" | "red" | "neutral"
): string {
  switch (tone) {
    case "blue":
      return "card-tinted card-tinted-blue";
    case "green":
      return "card-tinted card-tinted-green";
    case "orange":
      return "card-tinted card-tinted-orange";
    case "red":
      return "card-tinted card-tinted-red";
    case "neutral":
      return "card";
  }
}

function attendanceTone(
  rate: number | null
): "green" | "orange" | "red" | "neutral" {
  if (rate === null) return "neutral";
  if (rate >= 85) return "green";
  if (rate >= 70) return "orange";
  return "red";
}

function AttendanceKpi({
  id,
  attendanceRate,
  marked,
  totalSessions,
}: {
  id: string;
  attendanceRate: number | null;
  marked: number | null;
  totalSessions: number | null;
}) {
  const tone = attendanceTone(attendanceRate);
  return (
    <Link
      href={`/student/courses/${id}/attendance`}
      className={
        kpiToneClass(tone) +
        " group block p-5 hover:no-underline transition-transform"
      }
      style={{
        transition:
          "transform var(--duration-spring-standard) var(--ease-spring)",
      }}
    >
      <p className="flex items-center gap-1.5 text-xs font-medium opacity-80">
        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
        อัตรามาเรียน
      </p>
      <p
        className="mt-2 text-3xl font-semibold"
        style={{ letterSpacing: "-0.02em" }}
      >
        {attendanceRate === null ? (
          <span className="opacity-40">—</span>
        ) : (
          <>
            <AnimatedStat value={attendanceRate} />
            <span className="ml-1 text-base font-medium opacity-60">%</span>
          </>
        )}
      </p>
      <p className="mt-1 text-[11px] opacity-70">
        {marked !== null && totalSessions !== null
          ? `เช็คชื่อแล้ว ${marked} / ${totalSessions} คาบ`
          : "ยังไม่มีข้อมูลเช็คชื่อ"}
      </p>
    </Link>
  );
}

function ScoreKpi({
  id,
  percent,
  publishedItems,
  totalItems,
  lockedItems,
}: {
  id: string;
  percent: number | null;
  publishedItems: number;
  totalItems: number;
  lockedItems: number;
}) {
  const tone = percent === null ? "neutral" : "blue";
  return (
    <Link
      href={`/student/courses/${id}/scores`}
      className={
        kpiToneClass(tone) +
        " group block p-5 hover:no-underline transition-transform"
      }
      style={{
        transition:
          "transform var(--duration-spring-standard) var(--ease-spring)",
      }}
    >
      <p className="flex items-center gap-1.5 text-xs font-medium opacity-80">
        <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
        คะแนนรวม (ที่เผยแพร่)
      </p>
      <p
        className="mt-2 text-3xl font-semibold"
        style={{ letterSpacing: "-0.02em" }}
      >
        {percent === null ? (
          <span className="opacity-40">—</span>
        ) : (
          <>
            <AnimatedStat value={Math.round(percent)} />
            <span className="ml-1 text-base font-medium opacity-60">%</span>
          </>
        )}
      </p>
      <p className="mt-1 text-[11px] opacity-70">
        {publishedItems} / {totalItems} รายการ
        {lockedItems > 0 && <> · ยังไม่เผยแพร่ {lockedItems}</>}
      </p>
    </Link>
  );
}

function PendingKpi({ id, pending }: { id: string; pending: number }) {
  const tone: "green" | "orange" = pending === 0 ? "green" : "orange";
  return (
    <Link
      href={`/student/courses/${id}/assignments`}
      className={
        kpiToneClass(tone) +
        " group block p-5 hover:no-underline transition-transform"
      }
      style={{
        transition:
          "transform var(--duration-spring-standard) var(--ease-spring)",
      }}
    >
      <p className="flex items-center gap-1.5 text-xs font-medium opacity-80">
        <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
        การบ้านที่ต้องทำ
      </p>
      <p
        className="mt-2 text-3xl font-semibold"
        style={{ letterSpacing: "-0.02em" }}
      >
        <AnimatedStat value={pending} />
        <span className="ml-1 text-base font-medium opacity-60">รายการ</span>
      </p>
      <p className="mt-1 inline-flex items-center gap-1 text-[11px] opacity-80">
        {pending === 0 ? (
          <>
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            ส่งครบแล้ว
          </>
        ) : (
          "ยังไม่ส่ง · ร่าง · ส่งคืน"
        )}
      </p>
    </Link>
  );
}

// formatPercent is no longer used inline — Math.round + suffix span
// covers the new presentation. Keep import in case future tiles need it.
void formatPercent;
