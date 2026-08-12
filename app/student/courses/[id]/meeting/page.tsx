import { notFound, redirect } from "next/navigation";

import { CourseShell } from "@/components/course/course-shell";
import { RoomWorkspace } from "@/components/meeting/room-workspace";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForStudent } from "@/lib/course/queries";
import { db } from "@/lib/db/client";
import { stageEnabled } from "@/lib/meeting/livekit";
import { studentCourseTabs } from "../_tabs";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Where today's class meets online, for a student (ADR-0053).
 *
 * The tab is always here, including between classes: one that appears only
 * while a room is open is one nobody learns the position of. When nothing is
 * running the page says so.
 *
 * The link is never rendered on this page. It arrives from the join request,
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
  const [course, me] = await Promise.all([
    getCourseOfferingForStudent(id, session.user.id),
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
      eyebrow="ห้องเรียน"
      backHref="/dashboard"
      tabs={studentCourseTabs(id)}
    >
      <RoomWorkspace
        courseId={id}
        isTeacher={false}
        stageEnabled={stageEnabled()}
        self={{
          userId: session.user.id,
          name: personName(me),
          profileImageId: me?.profileImageId ?? null,
        }}
      />
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
