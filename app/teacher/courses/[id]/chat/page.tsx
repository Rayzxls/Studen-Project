import { notFound, redirect } from "next/navigation";

import {
  CourseChannel,
  type CourseChannelMessage,
} from "@/components/chat/course-channel";
import { CourseShell } from "@/components/course/course-shell";
import { requireRole } from "@/lib/auth/guards";
import { listCourseChannelMessages } from "@/lib/chat/course-channel";
import { chatEnabled } from "@/lib/chat/feature-flags";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { moderationCenterEnabled } from "@/lib/moderation/feature-flags";
import { teacherCourseTabs } from "../_tabs";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TeacherCourseChatPage({ params }: PageProps) {
  if (!chatEnabled()) notFound();

  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;
  const course = await getCourseOfferingForTeacher(id, session.user.id);
  if (!course) notFound();
  const initial = await listCourseChannelMessages({
    courseOfferingId: id,
    ctx: { actorUserId: session.user.id },
  });

  return (
    <CourseShell
      session={session}
      course={course}
      eyebrow="รายวิชาที่สอน"
      backHref="/teacher/courses"
      tabs={teacherCourseTabs(id)}
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
