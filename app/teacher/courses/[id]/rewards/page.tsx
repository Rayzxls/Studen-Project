import { notFound, redirect } from "next/navigation";

import { CourseShell } from "@/components/course/course-shell";
import { TeacherCourseMilestones } from "@/components/reward/teacher-course-milestones";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { getTeacherCourseRewardMilestoneDashboard } from "@/lib/reward/course-milestones";
import { courseRewardMilestonesEnabled } from "@/lib/reward/feature-flags";
import { teacherCourseTabs } from "../_tabs";

export const dynamic = "force-dynamic";

export default async function TeacherCourseRewardsPage({
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
  if (!courseRewardMilestonesEnabled()) notFound();
  const [course, dashboard] = await Promise.all([
    getCourseOfferingForTeacher(id, session.user.id),
    getTeacherCourseRewardMilestoneDashboard({
      courseOfferingId: id,
      ctx: { actorUserId: session.user.id },
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
      <TeacherCourseMilestones dashboard={dashboard} />
    </CourseShell>
  );
}
