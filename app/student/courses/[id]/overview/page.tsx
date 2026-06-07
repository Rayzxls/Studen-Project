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
import { studentCourseTabs } from "../_tabs";
import { getAttendanceStatsForStudent } from "@/lib/attendance/queries";
import { listTimetableSlots } from "@/lib/attendance/timetable";
import { dayOfWeekShort } from "@/lib/attendance/format";
import { getOwnScoresForStudent } from "@/lib/scoring/queries";
import { weightedTotal } from "@/lib/scoring/calc";
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
  const percent = weightedTotal(calcItems, calcEntries);
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

  return (
    <CourseShell
      session={session}
      course={course}
      eyebrow="ห้องเรียน"
      backHref="/dashboard"
      tabs={studentCourseTabs(id)}
    >
      <div className="space-y-6">
        {/* 1) Class info card */}
        <div className="card p-6">
          <h2
            className="mb-3 flex items-center gap-2 text-base font-medium text-black"
            style={{ letterSpacing: "-0.01em" }}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
            </span>
            ตารางเรียน
          </h2>
          {slots.length === 0 ? (
            <p className="text-sm text-black/50">
              ครูยังไม่ได้ตั้งตารางเรียนประจำสัปดาห์
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm text-black/80">
              {slots.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-6 w-9 items-center justify-center rounded bg-black/[0.04] text-xs font-medium text-black/70">
                    {dayOfWeekShort(s.dayOfWeek)}
                  </span>
                  <span className="font-mono text-xs text-black">
                    {s.startTime}–{s.endTime}
                  </span>
                  {s.location && (
                    <span className="inline-flex items-center gap-0.5 text-xs text-black/60">
                      <MapPin className="h-3 w-3" aria-hidden="true" />
                      {s.location}
                    </span>
                  )}
                </li>
              ))}
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
      </div>
    </CourseShell>
  );
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
