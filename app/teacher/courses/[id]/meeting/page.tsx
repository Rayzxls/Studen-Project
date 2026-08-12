import { notFound, redirect } from "next/navigation";

import { CourseShell } from "@/components/course/course-shell";
import { LiveRoomCard } from "@/components/meeting/live-room-card";
import { MeetingLinkCard } from "@/components/course/meeting-link-card";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { teacherCourseTabs } from "../_tabs";
import { closeRoomAction, openRoomAction } from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * The teacher's online room (ADR-0052 for the link, ADR-0053 for the room).
 *
 * A tab of its own because starting a class is a thing a teacher goes to do,
 * and a control they have to hunt for on a dashboard is one they will not use
 * when a class is already two minutes late.
 *
 * Two cards, in the order the questions arrive: open the room now, and — below
 * it, because it is set once a term — where the room is.
 */
export default async function TeacherMeetingPage({ params }: PageProps) {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;
  const course = await getCourseOfferingForTeacher(id, session.user.id);
  if (!course) notFound();

  return (
    <CourseShell
      session={session}
      course={course}
      eyebrow="รายวิชาที่สอน"
      backHref="/teacher/courses"
      tabs={teacherCourseTabs(id)}
    >
      <div className="space-y-6">
        <LiveRoomCard
          courseId={id}
          isTeacher
          openAction={openRoomAction}
          closeAction={closeRoomAction}
          showWhenClosed
        />

        <MeetingLinkCard courseId={id} meetingUrl={course.meetingUrl ?? null} />
      </div>
    </CourseShell>
  );
}
