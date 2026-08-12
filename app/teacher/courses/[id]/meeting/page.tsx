import { notFound, redirect } from "next/navigation";

import { CourseShell } from "@/components/course/course-shell";
import { MeetingLinkCard } from "@/components/course/meeting-link-card";
import { RoomWorkspace } from "@/components/meeting/room-workspace";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { db } from "@/lib/db/client";
import { stageEnabled } from "@/lib/meeting/livekit";
import { teacherCourseTabs } from "../_tabs";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * The teacher's online room (ADR-0052 for the link, ADR-0053 for the room).
 *
 * A tab of its own because starting a class is something a teacher goes to do,
 * and a control they have to hunt for on a dashboard is one they will not find
 * when a class is already two minutes late.
 *
 * The link editor appears only when no media server is configured. Once the
 * stage carries the class the link is dead weight, and a field asking for one
 * is a question about plumbing a teacher should never have to answer.
 */
export default async function TeacherMeetingPage({ params }: PageProps) {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const stage = stageEnabled();
  const { id } = await params;
  const [course, me] = await Promise.all([
    getCourseOfferingForTeacher(id, session.user.id),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { firstName: true, lastName: true, profileImageId: true },
    }),
  ]);
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
        <RoomWorkspace
          courseId={id}
          isTeacher
          stageEnabled={stage}
          self={{
            userId: session.user.id,
            name: personName(me),
            profileImageId: me?.profileImageId ?? null,
          }}
        />

        {/* Only when there is no stage of our own. With one, the room needs no
            outside link and a field asking for one is a question about
            plumbing that the teacher should never have to answer. */}
        {stage ? null : (
          <MeetingLinkCard
            courseId={id}
            meetingUrl={course.meetingUrl ?? null}
          />
        )}
      </div>
    </CourseShell>
  );
}

function personName(
  person: { firstName: string | null; lastName: string | null } | null
): string {
  const name = [person?.firstName, person?.lastName]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .trim();
  return name.length > 0 ? name : "บัญชีของคุณ";
}
