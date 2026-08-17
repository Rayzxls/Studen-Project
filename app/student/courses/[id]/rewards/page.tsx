import { notFound, redirect } from "next/navigation";

import { CourseShell } from "@/components/course/course-shell";
import { StudentCourseMilestones } from "@/components/reward/student-course-milestones";
import { assert } from "@/lib/auth/guards";
import { getCourseOfferingForStudent } from "@/lib/course/queries";
import { getStudentCourseRewardMilestoneDashboard } from "@/lib/reward/course-milestones";
import { courseRewardMilestonesEnabled } from "@/lib/reward/feature-flags";
import { studentCourseTabs } from "../_tabs";

export const dynamic = "force-dynamic";

export default async function StudentCourseRewardsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!courseRewardMilestonesEnabled()) notFound();

  let guard;
  try {
    guard = await assert.isActiveCourseMember(id);
  } catch {
    redirect("/dashboard");
  }

  const [course, dashboard] = await Promise.all([
    getCourseOfferingForStudent(id, guard.session.user.id),
    getStudentCourseRewardMilestoneDashboard({
      courseOfferingId: id,
      ctx: { actorUserId: guard.session.user.id },
    }),
  ]);
  if (!course) notFound();

  return (
    <CourseShell
      session={guard.session}
      course={course}
      eyebrow="ห้องเรียน"
      backHref="/dashboard"
      tabs={studentCourseTabs(id)}
    >
      <StudentCourseMilestones dashboard={dashboard} />
    </CourseShell>
  );
}
