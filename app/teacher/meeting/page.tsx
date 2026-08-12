import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { TopNav } from "@/components/layout/top-nav";
import { OpenRoomsList } from "@/components/meeting/open-rooms-list";
import { requireRole } from "@/lib/auth/guards";
import { listTeacherCourses } from "@/lib/course/enrollment";
import { openRoomsForTeacher } from "@/lib/meeting/room";

export const dynamic = "force-dynamic";

/**
 * Every room this teacher has open, across every course (ADR-0053).
 *
 * The app-level answer to "am I still live anywhere", which the standing
 * reminder in the top bar answers in passing and this page answers on purpose.
 * It links into each course's own room rather than opening or joining here —
 * that page already owns the roster, the stage and the controls, and two places
 * that can put someone into a call is one too many.
 */
export default async function TeacherMeetingHubPage() {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const [rooms, courses] = await Promise.all([
    openRoomsForTeacher({ teacherUserId: session.user.id }),
    listTeacherCourses(session.user.id),
  ]);

  return (
    <div className="min-h-screen bg-bg">
      <TopNav session={session} />

      <main className="mx-auto max-w-4xl animate-fade-in px-4 py-8 sm:px-6 md:py-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs font-medium text-ink-mute transition hover:text-ink hover:no-underline"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          กลับไป Dashboard
        </Link>

        <div className="mt-5">
          <div className="badge mb-2">ครูผู้สอน</div>
          <h1
            className="text-3xl font-semibold text-ink md:text-4xl"
            style={{ letterSpacing: "-0.03em" }}
          >
            ห้องเรียนออนไลน์
          </h1>
          <p className="mt-1 text-sm text-ink-mute">
            ห้องที่คุณเปิดอยู่ตอนนี้ทั้งหมด · เปิดห้องใหม่ได้จากแท็บ ห้องออนไลน์
            ในรายวิชา
          </p>
        </div>

        <div className="mt-6">
          <OpenRoomsList
            rooms={rooms}
            basePath="/teacher/courses"
            emptyTitle="ยังไม่มีห้องที่เปิดอยู่"
            emptyBody={
              courses.length > 0
                ? "เปิดห้องได้จากแท็บ ห้องออนไลน์ ในรายวิชาที่จะสอน"
                : "ยังไม่มีรายวิชาที่สอน สร้างวิชาก่อนแล้วจึงเปิดห้องได้"
            }
          />
        </div>
      </main>
    </div>
  );
}
