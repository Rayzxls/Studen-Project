import { notFound, redirect } from "next/navigation";

import { CourseShell } from "@/components/course/course-shell";
import { TeacherPublishingScheduleView } from "@/components/publishing/teacher-publishing-schedule";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { getTeacherPublishingSchedule } from "@/lib/publishing/teacher-schedule";
import { teacherCourseTabs } from "../_tabs";

export const dynamic = "force-dynamic";

export default async function TeacherPublishingSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;
  const course = await getCourseOfferingForTeacher(id, session.user.id);
  if (!course) notFound();

  const schedule = await getTeacherPublishingSchedule(id);

  return (
    <CourseShell
      session={session}
      course={course}
      eyebrow="รายวิชาที่สอน"
      backHref="/teacher/courses"
      tabs={teacherCourseTabs(id, schedule.upcoming.length)}
    >
      <TeacherPublishingScheduleView courseId={id} schedule={schedule} />
    </CourseShell>
  );
}
