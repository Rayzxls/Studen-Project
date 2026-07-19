import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, CalendarDays, ChevronLeft } from "lucide-react";
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
  const unscheduledCourses = courses
    .filter((course) => course.timetableSlots.length === 0)
    .map((course) => ({
      id: course.id,
      name: course.name,
      className: course.class.name,
      classId: course.classId,
      href: `/teacher/courses/${course.id}/settings`,
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
            eyebrow="พื้นที่ของครู"
            title="ตารางสอนของฉัน"
            description="รวมคาบจากทุกวิชาที่คุณดูแล กดคาบเพื่อแก้ไขวัน เวลา และสถานที่ได้ทันที"
            action={
              <Link href="/teacher/courses" className="btn-secondary btn-sm">
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                จัดการวิชา
              </Link>
            }
          />
        </div>

        <OperatingWorkspaceGrid
          role="teacher"
          showModeration={moderationCenterEnabled()}
          activeHref="/teacher/timetable"
          desktopNavigationOnly
          main={
            courses.length === 0 ? (
              <WorkspaceEmptyState
                icon={CalendarDays}
                title="ยังไม่มีตารางสอน"
                description="สร้างวิชาก่อน แล้วเพิ่มวัน เวลา และสถานที่ของแต่ละคาบได้จากหน้านี้"
                action={
                  <Link href="/teacher/courses" className="btn-primary btn-sm">
                    เลือกวิชา
                  </Link>
                }
              />
            ) : (
              <TimetableManager
                slots={slots}
                courses={courses.map((course) => ({
                  id: course.id,
                  name: course.name,
                  subjectCode: course.subjectCode,
                  className: course.class.name,
                }))}
                nowIso={nowIso}
                showBrief={false}
              />
            )
          }
          aside={
            <TimetableContextRail
              slots={slots}
              role="teacher"
              nowIso={nowIso}
              totalCourseCount={courses.length}
              unscheduledCourses={unscheduledCourses}
            />
          }
        />

        <div className="h-20 md:hidden" />
      </main>

      <StudentBottomNav role="teacher" />
    </div>
  );
}
