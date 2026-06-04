import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Ban } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { listSessions } from "@/lib/attendance/session";
import { listTimetableSlots } from "@/lib/attendance/timetable";
import { formatSessionHeader, todayInBangkok } from "@/lib/attendance/format";
import { CourseShell } from "@/components/course/course-shell";
import {
  CreateSessionForm,
  type TimetableSlotOption,
} from "@/components/attendance/create-session-form";
import { teacherCourseTabs } from "../_tabs";

// Auth-gated DB-fetching page — skip static prerender.
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

  const [sessions, slots] = await Promise.all([
    listSessions(id, { limit: 50 }),
    listTimetableSlots(id),
  ]);

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
      <div className="card p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2
              className="text-lg font-medium text-black"
              style={{ letterSpacing: "-0.02em" }}
            >
              คาบเรียน
            </h2>
            <p className="mt-0.5 text-xs text-black/50">
              ทั้งหมด {sessions.length} คาบ · เรียงจากใหม่ไปเก่า
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
                    "flex items-center justify-between gap-3 py-3 transition-colors hover:bg-slate-50/60 -mx-2 px-2 rounded-lg " +
                    (s.cancelledAt ? "opacity-60" : "")
                  }
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-black">
                      {formatSessionHeader(s.scheduledStart, s.scheduledEnd)}
                      {s.cancelledAt && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] text-rose-700">
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
                      <p className="mt-0.5 truncate text-xs text-rose-700/70">
                        เหตุผล: {s.cancelledReason}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right text-xs text-black/40">
                    {s._count.records} รายการ
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
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
