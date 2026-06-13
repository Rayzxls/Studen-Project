import Link from "next/link";
import { Ban, CalendarClock, ListChecks } from "lucide-react";
import { db } from "@/lib/db/client";
import { listSessions } from "@/lib/attendance/session";
import { formatSessionHeader } from "@/lib/attendance/format";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

type AttendanceCounts = {
  PRESENT: number;
  LATE: number;
  EXCUSED: number;
  ABSENT: number;
};

const EMPTY_COUNTS: AttendanceCounts = {
  PRESENT: 0,
  LATE: 0,
  EXCUSED: 0,
  ABSENT: 0,
};

export default async function AdminCourseAttendancePage({ params }: PageProps) {
  const { id } = await params;
  const [sessions, enrollments, attendanceGroups] = await Promise.all([
    listSessions(id, { limit: 100 }),
    db.enrollment.findMany({
      where: { courseOfferingId: id, removedAt: null },
      select: {
        id: true,
        student: {
          select: {
            userId: true,
            studentId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [
        { student: { firstName: "asc" } },
        { student: { lastName: "asc" } },
      ],
    }),
    db.attendanceRecord.groupBy({
      by: ["enrollmentId", "status"],
      where: { session: { courseOfferingId: id, cancelledAt: null } },
      _count: { _all: true },
    }),
  ]);

  const activeSessionCount = sessions.filter(
    (session) => !session.cancelledAt
  ).length;
  const countsByEnrollment = new Map<string, AttendanceCounts>();
  for (const group of attendanceGroups) {
    const counts = countsByEnrollment.get(group.enrollmentId) ?? {
      ...EMPTY_COUNTS,
    };
    counts[group.status] = group._count._all;
    countsByEnrollment.set(group.enrollmentId, counts);
  }

  return (
    <div className="space-y-4">
      <section className="card p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-medium tracking-tight text-black">
              <ListChecks className="h-5 w-5 text-blue-600" />
              การเข้าเรียนรายคน
            </h2>
            <p className="mt-1 text-xs text-ink-soft">
              แยกจำนวน มาเรียน / สาย / ลา / ขาด แล้วค่อยสรุปเป็นเปอร์เซ็นต์
              จากคาบที่เช็คแล้ว
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-500/10">
            คาบที่เปิดแล้ว {activeSessionCount.toLocaleString("th-TH")} คาบ
          </span>
        </div>

        {enrollments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/15 p-8 text-center">
            <p className="text-sm text-ink-soft">
              ยังไม่มีนักเรียนในรายวิชานี้
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-black/[0.08]">
            <table className="table w-full min-w-[820px]">
              <thead>
                <tr>
                  <th>นักเรียน</th>
                  <th className="text-right">มาเรียน</th>
                  <th className="text-right">สาย</th>
                  <th className="text-right">ลา</th>
                  <th className="text-right">ขาด</th>
                  <th className="text-right">ยังไม่เช็ค</th>
                  <th className="text-right">รวมเช็คแล้ว</th>
                  <th className="text-right">เข้าเรียน %</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((enrollment) => {
                  const counts =
                    countsByEnrollment.get(enrollment.id) ?? EMPTY_COUNTS;
                  const marked =
                    counts.PRESENT +
                    counts.LATE +
                    counts.EXCUSED +
                    counts.ABSENT;
                  const notMarked = Math.max(activeSessionCount - marked, 0);
                  const attendanceRate =
                    marked > 0
                      ? Math.round(
                          ((counts.PRESENT + counts.LATE) / marked) * 100
                        )
                      : null;

                  return (
                    <tr key={enrollment.id}>
                      <td>
                        <Link
                          href={`/admin/users/${enrollment.student.userId}`}
                          className="font-medium text-black hover:underline"
                        >
                          {enrollment.student.firstName}{" "}
                          {enrollment.student.lastName}
                        </Link>
                        <p className="mt-0.5 font-mono text-[10px] text-ink-soft">
                          {enrollment.student.studentId}
                        </p>
                      </td>
                      <td className="text-right text-sm font-medium text-green-700">
                        {counts.PRESENT}
                      </td>
                      <td className="text-right text-sm text-orange-600">
                        {counts.LATE}
                      </td>
                      <td className="text-right text-sm text-blue-600">
                        {counts.EXCUSED}
                      </td>
                      <td className="text-right text-sm font-medium text-red-600">
                        {counts.ABSENT}
                      </td>
                      <td className="text-right text-sm text-ink-soft">
                        {notMarked}
                      </td>
                      <td className="text-right text-sm">{marked}</td>
                      <td className="text-right text-sm font-semibold text-black">
                        {attendanceRate === null ? "—" : `${attendanceRate}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card p-6">
        <div className="mb-4">
          <h2 className="flex items-center gap-2 text-lg font-medium tracking-tight text-black">
            <CalendarClock className="h-5 w-5 text-blue-600" />
            คาบเรียน
          </h2>
          <p className="mt-1 text-xs text-ink-soft">
            ทั้งหมด {sessions.length.toLocaleString("th-TH")} คาบ ·
            อ่านอย่างเดียว
          </p>
        </div>

        {sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/15 p-8 text-center">
            <p className="text-sm text-ink-soft">ยังไม่มีคาบเรียน</p>
          </div>
        ) : (
          <ul className="divide-y divide-black/[0.06]">
            {sessions.map((session) => (
              <li
                key={session.id}
                className={
                  "-mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-3 " +
                  (session.cancelledAt ? "opacity-60" : "")
                }
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-black">
                    {formatSessionHeader(
                      session.scheduledStart,
                      session.scheduledEnd
                    )}
                    {session.cancelledAt && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700">
                        <Ban className="h-3 w-3" />
                        ยกเลิก
                      </span>
                    )}
                    {!session.timetableSlotId && !session.cancelledAt && (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                        ad-hoc
                      </span>
                    )}
                  </p>
                  {session.note && (
                    <p className="mt-0.5 truncate text-xs text-ink-soft">
                      {session.note}
                    </p>
                  )}
                  {session.cancelledAt && session.cancelledReason && (
                    <p className="mt-0.5 truncate text-xs text-red-700/70">
                      เหตุผล: {session.cancelledReason}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right text-xs text-ink-soft">
                  {session._count.records.toLocaleString("th-TH")} รายการ
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
