import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  BarChart3,
  CalendarClock,
  ClipboardList,
  Inbox,
  MapPin,
} from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForStudent } from "@/lib/course/queries";
import { db } from "@/lib/db/client";
import { CourseShell } from "@/components/course/course-shell";
import { studentCourseTabs } from "./_tabs";
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

  // ── Weighted-total preview (published items, own values) ──────
  const calcItems = scoreResult.items.map((it) => ({
    id: it.id,
    fullScore: it.fullScore,
    weight: it.weight,
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
            <CalendarClock
              className="h-4 w-4 text-black/40"
              aria-hidden="true"
            />
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

        {/* 2) My status — KPI row */}
        <div className="grid gap-4 md:grid-cols-3">
          <Link
            href={`/student/courses/${id}/attendance`}
            className="card p-5 hover:no-underline"
          >
            <p className="text-xs font-medium text-black/50">อัตรามาเรียน</p>
            <p className="mt-2 text-3xl font-medium text-black">
              {attendanceRate === null ? (
                <span className="text-black/30">—</span>
              ) : (
                <>
                  {attendanceRate}
                  <span className="text-base text-black/40"> %</span>
                </>
              )}
            </p>
            <p className="mt-1 text-[11px] text-black/50">
              {stats
                ? `เช็คชื่อแล้ว ${stats.marked} / ${stats.totalSessions} คาบ`
                : "ยังไม่มีข้อมูลเช็คชื่อ"}
            </p>
          </Link>

          <Link
            href={`/student/courses/${id}/scores`}
            className="card p-5 hover:no-underline"
          >
            <p className="flex items-center gap-1 text-xs font-medium text-black/50">
              <BarChart3 className="h-3 w-3" aria-hidden="true" />
              คะแนนรวม (ที่เผยแพร่)
            </p>
            <p className="mt-2 text-3xl font-medium text-black">
              {percent === null ? (
                <span className="text-black/30">—</span>
              ) : (
                formatPercent(percent)
              )}
            </p>
            <p className="mt-1 text-[11px] text-black/50">
              {scoreResult.publishedItems} / {scoreResult.totalItems} รายการ
              {lockedItems > 0 && (
                <span className="text-black/40">
                  {" "}
                  · ยังไม่เผยแพร่ {lockedItems}
                </span>
              )}
            </p>
          </Link>

          <Link
            href={`/student/courses/${id}/assignments`}
            className="card p-5 hover:no-underline"
          >
            <p className="flex items-center gap-1 text-xs font-medium text-black/50">
              <ClipboardList className="h-3 w-3" aria-hidden="true" />
              การบ้านที่ต้องทำ
            </p>
            <p className="mt-2 text-3xl font-medium text-black">
              {pendingAssignmentCount === 0 ? (
                <span className="text-emerald-700">0</span>
              ) : (
                pendingAssignmentCount
              )}
              <span className="text-base text-black/40"> รายการ</span>
            </p>
            <p className="mt-1 text-[11px] text-black/50">
              {pendingAssignmentCount === 0
                ? "ส่งครบแล้ว 🎉"
                : "ยังไม่ส่ง · ร่าง · ส่งคืน"}
            </p>
          </Link>
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
