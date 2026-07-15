import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Ban, Download, ListChecks } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { listSessions } from "@/lib/attendance/session";
import { listTimetableSlots } from "@/lib/attendance/timetable";
import { getAttendanceSummaryForTeacher } from "@/lib/attendance/queries";
import { formatSessionHeader, todayInBangkok } from "@/lib/attendance/format";
import { CourseShell } from "@/components/course/course-shell";
import {
  CreateSessionForm,
  type TimetableSlotOption,
} from "@/components/attendance/create-session-form";
import { teacherCourseTabs } from "../_tabs";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AttendanceListPage({ params }: PageProps) {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;
  const course = await getCourseOfferingForTeacher(id, session.user.id);
  if (!course) notFound();

  const [sessions, slots, attendanceSummary] = await Promise.all([
    listSessions(id, { limit: 100 }),
    listTimetableSlots(id),
    getAttendanceSummaryForTeacher(id, session.user.id),
  ]);

  const activeSessionCount = attendanceSummary.totalSessions;

  const slotOptions: TimetableSlotOption[] = slots.map((s) => ({
    id: s.id,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    location: s.location,
  }));

  return (
    <CourseShell
      session={session}
      course={course}
      eyebrow="รายวิชาที่สอน"
      backHref="/teacher/courses"
      tabs={teacherCourseTabs(id)}
    >
      <div className="space-y-4">
        <section className="card p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-medium tracking-tight text-black">
                <ListChecks className="h-5 w-5 text-blue-600" />
                การเข้าเรียนรายคน
              </h2>
              <p className="mt-1 text-xs text-black/50">
                แยกจำนวน มาเรียน / สาย / ลา / ขาด แล้วค่อยสรุปเป็นเปอร์เซ็นต์
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/teacher/courses/${id}/attendance/export`}
                className="btn-secondary btn-sm"
              >
                <Download className="h-4 w-4" />
                ดาวน์โหลด CSV
              </a>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-500/10">
                คาบที่เปิดแล้ว {activeSessionCount.toLocaleString("th-TH")} คาบ
              </span>
            </div>
          </div>

          {attendanceSummary.rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/15 p-8 text-center text-sm text-black/50">
              ยังไม่มีนักเรียนในรายวิชานี้
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
                  {attendanceSummary.rows.map((enrollment) => {
                    const counts = enrollment.counts;
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
                      <tr key={enrollment.enrollmentId}>
                        <td>
                          <p className="font-medium text-black">
                            {enrollment.student.firstName}{" "}
                            {enrollment.student.lastName}
                          </p>
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
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium tracking-tight text-black">
                คาบเรียน
              </h2>
              <p className="mt-1 text-xs text-black/50">
                ทั้งหมด {sessions.length.toLocaleString("th-TH")} คาบ ·
                เรียงจากใหม่ไปเก่า
              </p>
            </div>
            <CreateSessionForm
              courseId={id}
              slots={slotOptions}
              defaultDate={todayInBangkok()}
            />
          </div>

          {sessions.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="divide-y divide-slate-100">
              {sessions.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/teacher/courses/${id}/attendance/${s.id}`}
                    className={
                      "flex items-center justify-between gap-3 rounded-lg py-3 transition-colors hover:bg-slate-50/60 -mx-2 px-2 " +
                      (s.cancelledAt ? "opacity-60" : "")
                    }
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-black">
                        {formatSessionHeader(s.scheduledStart, s.scheduledEnd)}
                        {s.cancelledAt && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700">
                            <Ban className="h-3 w-3" />
                            ยกเลิก
                          </span>
                        )}
                        {!s.timetableSlotId && !s.cancelledAt && (
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                            ad-hoc
                          </span>
                        )}
                      </p>
                      {s.note && (
                        <p className="mt-0.5 truncate text-xs text-black/50">
                          {s.note}
                        </p>
                      )}
                      {s.cancelledAt && s.cancelledReason && (
                        <p className="mt-0.5 truncate text-xs text-red-700/70">
                          เหตุผล: {s.cancelledReason}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right text-xs text-black/40">
                      {s._count.records.toLocaleString("th-TH")} รายการ
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </CourseShell>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
      <p className="text-sm text-black/60">ยังไม่มีคาบเรียน</p>
      <p className="mt-1 text-xs text-black/40">
        กด &ldquo;เปิดคาบ&rdquo; ด้านบนเพื่อเริ่มเช็คชื่อคาบแรก
      </p>
    </div>
  );
}
