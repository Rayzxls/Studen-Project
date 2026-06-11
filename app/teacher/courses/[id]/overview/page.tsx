import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Award, CalendarCheck, ClipboardCheck, Users } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { getScoreboardForTeacher } from "@/lib/scoring/queries";
import { gradeForCourseOffering, scoreTotal } from "@/lib/scoring/calc";
import { formatPercent } from "@/lib/scoring/format";
import { db } from "@/lib/db/client";
import { SubmissionStatus, type AttendanceStatus } from "@prisma/client";
import { CourseShell } from "@/components/course/course-shell";
import { AnimatedStat } from "@/components/dashboard/animated-stat";
import { teacherCourseTabs } from "../_tabs";

/**
 * Teacher course overview — per-course dashboard (CONTEXT § Learning
 * Results: "เกรด" = เกรดรายวิชา).
 *
 * KPI strip + a per-student results table (score total / % / เกรดรายวิชา /
 * attendance / pending review) for THIS CourseOffering only. No Term GPA —
 * the teacher never rolls grades up across courses here. Class Code
 * management lives in the ตั้งค่า tab (ClassCodeControls), not in the
 * overview.
 *
 * Score figures are computed over PUBLISHED ScoreItems only — identical to
 * what the student sees — and rows with unpublished items are labelled
 * "กำลังอัปเดต" so a partial number is never read as final.
 */

// Auth-gated DB-fetching page — skip static prerender.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseOverviewPage({ params }: PageProps) {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;
  const course = await getCourseOfferingForTeacher(id, session.user.id);
  if (!course) notFound();

  const [scoreboard, pendingByEnrollment, attendanceByEnrollment] =
    await Promise.all([
      getScoreboardForTeacher(id, session.user.id),
      db.submission.groupBy({
        by: ["enrollmentId"],
        where: {
          assignment: { courseOfferingId: id },
          status: {
            in: [SubmissionStatus.SUBMITTED, SubmissionStatus.LATE_SUBMITTED],
          },
        },
        _count: { _all: true },
      }),
      db.attendanceRecord.groupBy({
        by: ["enrollmentId", "status"],
        where: { session: { courseOfferingId: id, cancelledAt: null } },
        _count: { _all: true },
      }),
    ]);

  const pendingMap = new Map(
    pendingByEnrollment.map((g) => [g.enrollmentId, g._count._all])
  );

  // Per-enrollment attendance tallies — attended = PRESENT + LATE over
  // marked records (same convention as lib/dashboard getStudentStats).
  const attendanceMap = new Map<string, { marked: number; attended: number }>();
  for (const g of attendanceByEnrollment) {
    const t = attendanceMap.get(g.enrollmentId) ?? { marked: 0, attended: 0 };
    t.marked += g._count._all;
    if (
      (g.status as AttendanceStatus) === "PRESENT" ||
      (g.status as AttendanceStatus) === "LATE"
    ) {
      t.attended += g._count._all;
    }
    attendanceMap.set(g.enrollmentId, t);
  }

  const items = scoreboard.items.map((it) => ({
    id: it.id,
    fullScore: it.fullScore,
    publishedAt: it.publishedAt,
  }));
  const publishedItems = items.filter((it) => it.publishedAt !== null);
  const publishedFullSum = publishedItems.reduce(
    (sum, it) => (it.fullScore > 0 ? sum + it.fullScore : sum),
    0
  );
  const isPublishComplete =
    items.length > 0 && publishedItems.length === items.length;

  const activeRows = scoreboard.rows.filter((r) => r.removedAt === null);

  const studentRows = scoreboard.rows.map((r) => {
    const entries = r.entries.map((e) => ({
      scoreItemId: e.scoreItemId,
      value: e.value,
    }));
    const res = gradeForCourseOffering(items, entries);
    const percent = scoreTotal(items, entries);

    const entryByItem = new Map(entries.map((e) => [e.scoreItemId, e.value]));
    let scoreSum = 0;
    for (const it of publishedItems) {
      if (it.fullScore <= 0) continue;
      scoreSum += entryByItem.get(it.id) ?? 0;
    }

    const att = attendanceMap.get(r.enrollmentId);
    const attendanceRate =
      att && att.marked > 0
        ? Math.round((att.attended / att.marked) * 100)
        : null;

    return {
      ...r,
      scoreSum,
      percent,
      grade: res.grade,
      attendanceRate,
      pending: pendingMap.get(r.enrollmentId) ?? 0,
    };
  });

  // KPI aggregates.
  const pendingTotal = pendingByEnrollment.reduce(
    (sum, g) => sum + g._count._all,
    0
  );
  let markedAll = 0;
  let attendedAll = 0;
  for (const t of attendanceMap.values()) {
    markedAll += t.marked;
    attendedAll += t.attended;
  }
  const avgAttendance =
    markedAll > 0 ? Math.round((attendedAll / markedAll) * 100) : null;

  return (
    <CourseShell
      session={session}
      course={course}
      eyebrow="รายวิชาที่สอน"
      backHref="/teacher/courses"
      tabs={teacherCourseTabs(id)}
    >
      <div className="space-y-6">
        {/* KPI strip */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href={`/teacher/courses/${id}/members`}
            className="card-tinted card-tinted-blue group block p-5 hover:no-underline"
          >
            <p className="flex items-center gap-1.5 text-xs font-medium opacity-80">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              นักเรียนทั้งหมด
            </p>
            <p
              className="mt-2 text-3xl font-semibold"
              style={{ letterSpacing: "-0.02em" }}
            >
              <AnimatedStat value={activeRows.length} />
              <span className="ml-1 text-base font-medium opacity-60">คน</span>
            </p>
          </Link>

          <Link
            href={`/teacher/courses/${id}/assignments`}
            className={
              (pendingTotal > 0 ? "card-tinted card-tinted-orange" : "card") +
              " group block p-5 hover:no-underline"
            }
          >
            <p
              className={
                "flex items-center gap-1.5 text-xs font-medium " +
                (pendingTotal > 0 ? "opacity-80" : "text-black/50")
              }
            >
              <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
              งานรอตรวจ
            </p>
            <p
              className={
                "mt-2 text-3xl font-semibold " +
                (pendingTotal === 0 ? "text-black" : "")
              }
              style={{ letterSpacing: "-0.02em" }}
            >
              <AnimatedStat value={pendingTotal} />
              <span
                className={
                  "ml-1 text-base font-medium " +
                  (pendingTotal > 0 ? "opacity-60" : "text-black/40")
                }
              >
                ชิ้น
              </span>
            </p>
          </Link>

          <Link
            href={`/teacher/courses/${id}/scores`}
            className="card-tinted card-tinted-blue group block p-5 hover:no-underline"
          >
            <p className="flex items-center gap-1.5 text-xs font-medium opacity-80">
              <Award className="h-3.5 w-3.5" aria-hidden="true" />
              คะแนนที่ประกาศแล้ว
            </p>
            <p
              className="mt-2 text-3xl font-semibold"
              style={{ letterSpacing: "-0.02em" }}
            >
              <AnimatedStat value={publishedItems.length} />
              <span className="ml-1 text-base font-medium opacity-60">
                /{items.length} รายการ
              </span>
            </p>
          </Link>

          <Link
            href={`/teacher/courses/${id}/attendance`}
            className="card-tinted card-tinted-blue group block p-5 hover:no-underline"
          >
            <p className="flex items-center gap-1.5 text-xs font-medium opacity-80">
              <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
              เข้าเรียนเฉลี่ย
            </p>
            <p
              className="mt-2 text-3xl font-semibold"
              style={{ letterSpacing: "-0.02em" }}
            >
              {avgAttendance !== null ? (
                <>
                  <AnimatedStat value={avgAttendance} />
                  <span className="ml-1 text-base font-medium opacity-60">
                    %
                  </span>
                </>
              ) : (
                <span className="text-base font-medium opacity-60">
                  ยังไม่มีการเช็คชื่อ
                </span>
              )}
            </p>
          </Link>
        </div>

        {/* Per-student results table */}
        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              className="text-lg font-medium text-black"
              style={{ letterSpacing: "-0.02em" }}
            >
              ผลการเรียนรายคน ({studentRows.length})
            </h2>
            {!isPublishComplete && items.length > 0 && (
              <span className="inline-flex rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
                กำลังอัปเดต — ประกาศแล้ว {publishedItems.length}/{items.length}{" "}
                รายการ
              </span>
            )}
          </div>

          {studentRows.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-black/15 p-8 text-center text-sm text-black/50">
              ยังไม่มีนักเรียนในวิชานี้ — แชร์ Class Code ได้ที่แท็บ{" "}
              <Link
                href={`/teacher/courses/${id}/settings`}
                className="text-blue-700 underline underline-offset-2"
              >
                ตั้งค่า
              </Link>
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-hairline bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bg text-left text-xs font-medium text-ink-soft">
                    <th className="px-3 py-2">นักเรียน</th>
                    <th className="px-3 py-2 text-right">คะแนนรวม</th>
                    <th className="px-3 py-2 text-right">%</th>
                    <th className="px-3 py-2 text-right">เกรด</th>
                    <th className="px-3 py-2 text-right">เข้าเรียน</th>
                    <th className="px-3 py-2 text-right">รอตรวจ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {studentRows.map((r) => (
                    <tr
                      key={r.enrollmentId}
                      className={
                        "transition-colors hover:bg-bg " +
                        (r.removedAt !== null ? "opacity-60" : "")
                      }
                    >
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-black">
                          {r.firstName} {r.lastName}
                        </p>
                        <p className="font-mono text-[11px] text-ink-mute">
                          {r.studentId}
                          {r.removedAt !== null && (
                            <span className="ml-2 rounded bg-red-50 px-1 py-0.5 text-[10px] font-sans text-red-700">
                              นำออกจากห้อง
                            </span>
                          )}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-right text-ink-soft">
                        {publishedFullSum > 0 ? (
                          <>
                            {r.scoreSum}
                            <span className="text-ink-mute">
                              /{publishedFullSum}
                            </span>
                          </>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {publishedFullSum > 0 ? formatPercent(r.percent) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold">
                        {r.grade !== null ? (
                          <span className="text-blue-700">
                            {r.grade.toFixed(1)}
                          </span>
                        ) : items.length > 0 && publishedItems.length > 0 ? (
                          <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700">
                            กำลังอัปเดต
                          </span>
                        ) : (
                          <span className="font-normal text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {r.attendanceRate !== null ? (
                          <span
                            className={
                              "rounded-full px-2 py-0.5 text-xs font-medium " +
                              (r.attendanceRate >= 80
                                ? "bg-green-50 text-green-700"
                                : r.attendanceRate >= 50
                                  ? "bg-orange-50 text-orange-700"
                                  : "bg-red-50 text-red-700")
                            }
                          >
                            {r.attendanceRate}%
                          </span>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {r.pending > 0 ? (
                          <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
                            {r.pending} ชิ้น
                          </span>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-xs text-ink-mute">
            คะแนน / % / เกรด คำนวณจากรายการคะแนนที่ประกาศแล้วเท่านั้น
            (ตรงกับที่นักเรียนเห็น) — เกรดรายวิชาจะคำนวณเมื่อประกาศครบทุกรายการ
          </p>
        </div>
      </div>
    </CourseShell>
  );
}
