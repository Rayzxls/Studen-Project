import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { moderationCenterEnabled } from "@/lib/moderation/feature-flags";
import { TopNav } from "@/components/layout/top-nav";
import { StudentBottomNav } from "@/components/layout/student-bottom-nav";
import {
  OperatingWorkspaceGrid,
  WorkspaceEmptyState,
  WorkspacePageHeader,
} from "@/components/layout/operating-workspace";
import { TimetableContextRail } from "@/components/timetable/timetable-context-rail";
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
  const unscheduledCourses = enrollments
    .filter(({ course }) => course.timetableSlots.length === 0)
    .map(({ course }) => ({
      id: course.id,
      name: course.name,
      className: course.class.name,
      classId: course.classId,
      href: `/student/courses/${course.id}`,
    }));
  const nowIso = new Date().toISOString();

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

        <div className="mt-5">
          <WorkspacePageHeader
            icon={CalendarDays}
            eyebrow="พื้นที่ของนักเรียน"
            title="ตารางเรียนของฉัน"
            description="รวมทุกวิชาที่กำลังเรียน ดูคาบปัจจุบันและคาบถัดไปได้ในหน้าเดียว"
          />
        </div>

        <OperatingWorkspaceGrid
          role="student"
          showModeration={moderationCenterEnabled()}
          activeHref="/student/timetable"
          desktopNavigationOnly
          main={
            slots.length === 0 ? (
              <WorkspaceEmptyState
                icon={CalendarDays}
                title="ยังไม่มีตารางเรียน"
                description="เมื่อครูตั้งตารางสอนของวิชาที่คุณเรียน คาบเรียนจะปรากฏที่นี่โดยอัตโนมัติ"
                action={
                  <Link
                    href="/student/courses"
                    className="btn-secondary btn-sm"
                  >
                    ดูห้องเรียนของฉัน
                  </Link>
                }
              />
            ) : (
              <WeeklyTimetable
                slots={slots}
                role="student"
                nowIso={nowIso}
                showBrief={false}
              />
            )
          }
          aside={
            <TimetableContextRail
              slots={slots}
              role="student"
              nowIso={nowIso}
              totalCourseCount={enrollments.length}
              unscheduledCourses={unscheduledCourses}
            />
          }
        />

        <div className="h-20 md:hidden" />
      </main>

      <StudentBottomNav role="student" />
    </div>
  );
}
