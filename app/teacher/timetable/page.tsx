import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, CalendarDays, ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { TopNav } from "@/components/layout/top-nav";
import { StudentBottomNav } from "@/components/layout/student-bottom-nav";
import { TimetableManager } from "@/components/timetable/timetable-manager";
import type { TimetableDisplaySlot } from "@/lib/timetable/view-model";

export const dynamic = "force-dynamic";

export default async function TeacherTimetablePage() {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const courses = await db.courseOffering.findMany({
    where: { teacherId: session.user.id, archivedAt: null },
    orderBy: { createdAt: "desc" },
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
  });

  const slots: TimetableDisplaySlot[] = courses.flatMap((course) =>
    course.timetableSlots.map((slot) => ({
      ...slot,
      courseId: course.id,
      courseName: course.name,
      subjectCode: course.subjectCode,
      className: course.class.name,
      classId: course.classId,
      href: `/teacher/courses/${course.id}/settings`,
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

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-700">
              <CalendarDays className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold text-ink md:text-3xl">
                ตารางสอนของฉัน
              </h1>
              <p className="mt-0.5 text-sm text-ink-mute">
                รวมคาบจากทุกวิชาที่คุณดูแล · กดคาบเพื่อจัดการในหน้าตั้งค่าวิชา
              </p>
            </div>
          </div>
          <Link href="/teacher/courses" className="btn-secondary btn-sm">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            จัดการวิชา
          </Link>
        </div>

        {courses.length === 0 ? (
          <div className="mt-6 grid min-h-64 place-items-center rounded-2xl border border-dashed border-hairline bg-surface p-8 text-center">
            <div>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-700">
                <CalendarDays className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-4 text-sm font-semibold text-ink">
                ยังไม่มีตารางสอน
              </p>
              <p className="mt-1 max-w-sm text-xs leading-5 text-ink-mute">
                เลือกวิชาที่สอน แล้วเพิ่มวัน เวลา
                และสถานที่ในหน้าตั้งค่าของวิชานั้น
              </p>
              <Link href="/teacher/courses" className="btn-primary btn-sm mt-4">
                เลือกวิชา
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <TimetableManager
              slots={slots}
              courses={courses.map((course) => ({
                id: course.id,
                name: course.name,
                subjectCode: course.subjectCode,
                className: course.class.name,
              }))}
              nowIso={new Date().toISOString()}
            />
          </div>
        )}

        <div className="h-20 md:hidden" />
      </main>

      <StudentBottomNav role="teacher" />
    </div>
  );
}
