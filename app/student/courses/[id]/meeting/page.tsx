import { notFound, redirect } from "next/navigation";

import { CourseShell } from "@/components/course/course-shell";
import { LiveRoomCard } from "@/components/meeting/live-room-card";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForStudent } from "@/lib/course/queries";
import { studentCourseTabs } from "../_tabs";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Where today's class meets online, for a student (ADR-0053).
 *
 * The tab is always there, including between classes, because a tab that
 * appears only while a room is open is one nobody learns the position of. When
 * nothing is running the page says so rather than showing an empty card, which
 * is why it passes `showWhenClosed`.
 *
 * The link itself is never rendered here. It arrives from the join request,
 * after a permission check, so a shut room hands out nothing.
 */
export default async function StudentMeetingPage({ params }: PageProps) {
  let session;
  try {
    session = await requireRole(["STUDENT"]);
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;
  const course = await getCourseOfferingForStudent(id, session.user.id);
  if (!course) notFound();

  return (
    <CourseShell
      session={session}
      course={course}
      eyebrow="ห้องเรียน"
      backHref="/dashboard"
      tabs={studentCourseTabs(id)}
    >
      <LiveRoomCard courseId={id} isTeacher={false} showWhenClosed />
    </CourseShell>
  );
}
