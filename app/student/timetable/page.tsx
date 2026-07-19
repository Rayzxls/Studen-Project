import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { TopNav } from "@/components/layout/top-nav";
import { StudentBottomNav } from "@/components/layout/student-bottom-nav";
import { WeeklyTimetable } from "@/components/timetable/weekly-timetable";
import type { TimetableDisplaySlot } from "@/lib/timetable/view-model";

/** Student-owned weekly projection. No peer data is selected or rendered. */
export const dynamic = "force-dynamic";

export default async function StudentTimetablePage() {
  let session;
  try {
    session = await requireRole(["STUDENT"]);
  } catch {
    redirect("/dashboard");
  }

  const enrollments = await db.enrollment.findMany({
    where: {
      studentId: session.user.id,
      removedAt: null,
      course: { archivedAt: null },
    },
    select: {
      course: {
        select: {
          id: true,
          name: true,
          subjectCode: true,
          classId: true,
          class: { select: { name: true } },
          timetableSlots: {
            select: {
              id: true,
              dayOfWeek: true,
              startTime: true,
              endTime: true,
              location: true,
            },
          },
        },
      },
    },
  });

  const slots: TimetableDisplaySlot[] = enrollments.flatMap(({ course }) =>
    course.timetableSlots.map((slot) => ({
      ...slot,
      courseId: course.id,
      courseName: course.name,
      subjectCode: course.subjectCode,
      className: course.class.name,
      classId: course.classId,
      href: `/student/courses/${course.id}`,
    }))
  );

  return (
    <div className="min-h-screen bg-bg">
      <TopNav session={session} maxWidth="max-w-[1480px]" />

      <main className="mx-auto max-w-[1480px] animate-fade-in px-4 py-8 sm:px-6 md:py-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs font-medium text-ink-mute transition-colors hover:text-ink hover:no-underline"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          กลับไป Dashboard
        </Link>

        <div className="mt-5 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-ink md:text-3xl">
              ตารางเรียนของฉัน
            </h1>
            <p className="mt-0.5 text-sm text-ink-mute">
              รวมทุกวิชาที่กำลังเรียน · ดูคาบปัจจุบันและคาบถัดไปได้ในหน้าเดียว
            </p>
          </div>
        </div>

        {slots.length === 0 ? (
          <div className="mt-6 grid min-h-64 place-items-center rounded-2xl border border-dashed border-hairline bg-surface p-8 text-center">
            <div>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-700">
                <CalendarDays className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-4 text-sm font-semibold text-ink">
                ยังไม่มีตารางเรียน
              </p>
              <p className="mt-1 max-w-sm text-xs leading-5 text-ink-mute">
                เมื่อครูตั้งตารางสอนของวิชาที่คุณเรียน
                คาบเรียนจะปรากฏที่นี่โดยอัตโนมัติ
              </p>
              <Link
                href="/student/courses"
                className="btn-secondary btn-sm mt-4"
              >
                ดูห้องเรียนของฉัน
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <WeeklyTimetable
              slots={slots}
              role="student"
              nowIso={new Date().toISOString()}
            />
          </div>
        )}

        <div className="h-20 md:hidden" />
      </main>

      <StudentBottomNav role="student" />
    </div>
  );
}
