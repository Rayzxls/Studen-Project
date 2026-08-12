import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { TopNav } from "@/components/layout/top-nav";
import { OpenRoomsList } from "@/components/meeting/open-rooms-list";
import { requireRole } from "@/lib/auth/guards";
import { openRoomsForStudent } from "@/lib/meeting/room";

export const dynamic = "force-dynamic";

/**
 * Any class happening right now, across everything this student is enrolled in
 * (ADR-0053).
 *
 * A student who missed the notification has nowhere else to look: the per-course
 * page only answers for one course, and checking six of them to find the live
 * one is not a thing anyone will do. Scoped to active enrolments, so a removed
 * student loses the listing with the course.
 *
 * No meeting link is rendered here. Where to go is the room page's answer,
 * behind its own permission check.
 */
export default async function StudentMeetingHubPage() {
  let session;
  try {
    session = await requireRole(["STUDENT"]);
  } catch {
    redirect("/dashboard");
  }

  const rooms = await openRoomsForStudent({ studentUserId: session.user.id });

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
          <div className="badge mb-2">ห้องเรียน</div>
          <h1
            className="text-3xl font-semibold text-ink md:text-4xl"
            style={{ letterSpacing: "-0.03em" }}
          >
            ห้องเรียนออนไลน์
          </h1>
          <p className="mt-1 text-sm text-ink-mute">
            วิชาที่ครูกำลังเปิดห้องอยู่ตอนนี้
          </p>
        </div>

        <div className="mt-6">
          <OpenRoomsList
            rooms={rooms}
            basePath="/student/courses"
            emptyTitle="ตอนนี้ยังไม่มีคาบไหนเปิดอยู่"
            emptyBody="เมื่อครูเปิดห้อง วิชานั้นจะขึ้นที่นี่ และคุณจะได้รับแจ้งเตือน"
          />
        </div>
      </main>
    </div>
  );
}
