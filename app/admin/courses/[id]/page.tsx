import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Award,
  CalendarCheck,
  ClipboardCheck,
  GraduationCap,
  Users,
} from "lucide-react";
import { AttendanceStatus, SubmissionStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { gradeForCourseOffering, scoreTotal } from "@/lib/scoring/calc";
import { formatPercent } from "@/lib/scoring/format";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminCourseOverviewPage({ params }: PageProps) {
  const { id } = await params;

  const courseExists = await db.courseOffering.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!courseExists) notFound();

  const [scoreItems, enrollments, pendingByEnrollment, attendanceByEnrollment] =
    await Promise.all([
      db.scoreItem.findMany({
        where: { courseOfferingId: id },
        select: {
          id: true,
          name: true,
          fullScore: true,
          position: true,
          publishedAt: true,
        },
        orderBy: [{ position: "asc" }, { id: "asc" }],
      }),
      db.enrollment.findMany({
        where: {
          courseOfferingId: id,
          OR: [
            { removedAt: null },
            { scoreEntries: { some: { scoreItem: { courseOfferingId: id } } } },
          ],
        },
        select: {
          id: true,
          removedAt: true,
          student: {
            select: {
              userId: true,
              studentId: true,
              firstName: true,
              lastName: true,
            },
          },
          scoreEntries: {
            where: { scoreItem: { courseOfferingId: id } },
            select: { scoreItemId: true, value: true },
          },
        },
        orderBy: [
          { student: { firstName: "asc" } },
          { student: { lastName: "asc" } },
        ],
      }),
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
  const attendanceMap = new Map<string, { marked: number; attended: number }>();
  for (const g of attendanceByEnrollment) {
    const row = attendanceMap.get(g.enrollmentId) ?? { marked: 0, attended: 0 };
    row.marked += g._count._all;
    if (
      g.status === AttendanceStatus.PRESENT ||
      g.status === AttendanceStatus.LATE
    ) {
      row.attended += g._count._all;
    }
    attendanceMap.set(g.enrollmentId, row);
  }

  const activeEnrollments = enrollments.filter((e) => e.removedAt === null);
  const publishedItems = scoreItems.filter((it) => it.publishedAt !== null);
  const publishedFullScore = publishedItems.reduce(
    (sum, it) => sum + Math.max(0, it.fullScore),
    0
  );
  const pendingTotal = pendingByEnrollment.reduce(
    (sum, g) => sum + g._count._all,
    0
  );

  let markedAll = 0;
  let attendedAll = 0;
  for (const row of attendanceMap.values()) {
    markedAll += row.marked;
    attendedAll += row.attended;
  }
  const avgAttendance =
    markedAll > 0 ? Math.round((attendedAll / markedAll) * 100) : null;

  const studentRows = enrollments.map((enrollment) => {
    const entries = enrollment.scoreEntries.map((entry) => ({
      scoreItemId: entry.scoreItemId,
      value: entry.value,
    }));
    const entryByItem = new Map(entries.map((e) => [e.scoreItemId, e.value]));
    const scoreSum = publishedItems.reduce((sum, item) => {
      if (item.fullScore <= 0) return sum;
      return sum + (entryByItem.get(item.id) ?? 0);
    }, 0);
    const grade = gradeForCourseOffering(scoreItems, entries);
    const percent = scoreTotal(scoreItems, entries);
    const attendance = attendanceMap.get(enrollment.id);
    const attendanceRate =
      attendance && attendance.marked > 0
        ? Math.round((attendance.attended / attendance.marked) * 100)
        : null;

    return {
      enrollment,
      scoreSum,
      percent,
      grade: grade.grade,
      attendanceRate,
      pending: pendingMap.get(enrollment.id) ?? 0,
    };
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          href={`/admin/courses/${id}/members`}
          icon={<Users className="h-4 w-4" />}
          label="นักเรียนทั้งหมด"
          value={activeEnrollments.length}
          suffix="คน"
          tone="blue"
        />
        <MetricCard
          href={`/admin/courses/${id}/assignments`}
          icon={<ClipboardCheck className="h-4 w-4" />}
          label="งานรอตรวจ"
          value={pendingTotal}
          suffix="ชิ้น"
          tone={pendingTotal > 0 ? "orange" : "plain"}
        />
        <MetricCard
          href={`/admin/courses/${id}/scores`}
          icon={<Award className="h-4 w-4" />}
          label="คะแนนที่ประกาศแล้ว"
          value={publishedItems.length}
          suffix="รายการ"
          tone="blue"
        />
        <MetricCard
          href={`/admin/courses/${id}/attendance`}
          icon={<CalendarCheck className="h-4 w-4" />}
          label="เข้าเรียนเฉลี่ย"
          value={avgAttendance ?? "—"}
          suffix={avgAttendance === null ? "" : "%"}
          tone="plain"
        />
      </div>

      <section className="card p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-medium tracking-tight text-black">
              <GraduationCap className="h-5 w-5 text-blue-600" />
              ผลการเรียนรายคน ({studentRows.length})
            </h2>
            <p className="mt-1 text-xs text-ink-soft">
              คะแนน / % / เกรด คำนวณจากรายการคะแนนที่ประกาศแล้วเท่านั้น
            </p>
          </div>
          <span className="rounded-full bg-black/[0.04] px-3 py-1 text-xs text-ink-soft">
            คะแนนเต็มที่ประกาศ {publishedFullScore}
          </span>
        </div>

        {studentRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/15 p-8 text-center text-sm text-ink-soft">
            ยังไม่มีนักเรียนในรายวิชานี้
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-black/[0.08]">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>นักเรียน</th>
                  <th className="text-right">คะแนนรวม</th>
                  <th className="text-right">%</th>
                  <th className="text-right">เกรด</th>
                  <th className="text-right">เข้าเรียน</th>
                  <th className="text-right">รอตรวจ</th>
                </tr>
              </thead>
              <tbody>
                {studentRows.map((row) => (
                  <tr key={row.enrollment.id}>
                    <td>
                      <Link
                        href={`/admin/users/${row.enrollment.student.userId}`}
                        className="font-medium text-black hover:underline"
                      >
                        {row.enrollment.student.firstName}{" "}
                        {row.enrollment.student.lastName}
                      </Link>
                      <p className="mt-0.5 font-mono text-[10px] text-ink-soft">
                        {row.enrollment.student.studentId}
                        {row.enrollment.removedAt && " · ออกจากรายวิชาแล้ว"}
                      </p>
                    </td>
                    <td className="text-right text-sm">
                      {row.scoreSum}/{publishedFullScore || 0}
                    </td>
                    <td className="text-right text-sm">
                      {row.percent === null ? "—" : formatPercent(row.percent)}
                    </td>
                    <td className="text-right text-sm font-semibold text-blue-600">
                      {row.grade === null ? "—" : row.grade.toFixed(1)}
                    </td>
                    <td className="text-right text-sm">
                      {row.attendanceRate === null
                        ? "—"
                        : `${row.attendanceRate}%`}
                    </td>
                    <td className="text-right text-sm">{row.pending}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({
  href,
  icon,
  label,
  value,
  suffix,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: number | string;
  suffix: string;
  tone: "blue" | "orange" | "plain";
}) {
  const className =
    tone === "blue"
      ? "card-tinted card-tinted-blue"
      : tone === "orange"
        ? "card-tinted card-tinted-orange"
        : "card";

  return (
    <Link href={href} className={`${className} block p-5 hover:no-underline`}>
      <p className="flex items-center gap-1.5 text-xs font-medium opacity-80">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">
        {typeof value === "number" ? value.toLocaleString("th-TH") : value}
        {suffix && <span className="ml-1 text-base font-medium">{suffix}</span>}
      </p>
    </Link>
  );
}
