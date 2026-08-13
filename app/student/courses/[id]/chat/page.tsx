import { notFound, redirect } from "next/navigation";

import {
  CourseChannel,
  type CourseChannelMessage,
} from "@/components/chat/course-channel";
import { CourseShell } from "@/components/course/course-shell";
import { requireRole } from "@/lib/auth/guards";
import { listCourseChannelMessages } from "@/lib/chat/course-channel";
import { chatEnabled } from "@/lib/chat/feature-flags";
import { getCourseOfferingForStudent } from "@/lib/course/queries";
import { moderationCenterEnabled } from "@/lib/moderation/feature-flags";
import { studentCourseTabs } from "../_tabs";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StudentCourseChatPage({ params }: PageProps) {
  if (!chatEnabled()) notFound();

  let session;
  try {
    session = await requireRole(["STUDENT"]);
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;
  const course = await getCourseOfferingForStudent(id, session.user.id);
  if (!course) notFound();
  const initial = await listCourseChannelMessages({
    courseOfferingId: id,
    ctx: { actorUserId: session.user.id },
  });

  return (
    <CourseShell
      session={session}
      course={course}
      eyebrow="ห้องเรียน"
      backHref="/dashboard"
      tabs={studentCourseTabs(id)}
    >
      <CourseChannel
        courseId={id}
        currentUserId={session.user.id}
        initialMessages={serializeMessages(initial.messages)}
        reportingEnabled={moderationCenterEnabled()}
      />
    </CourseShell>
  );
}

function serializeMessages(
  messages: Awaited<ReturnType<typeof listCourseChannelMessages>>["messages"]
): CourseChannelMessage[] {
  return messages.map((message) => ({
    ...message,
    createdAt: message.createdAt.toISOString(),
  }));
}
