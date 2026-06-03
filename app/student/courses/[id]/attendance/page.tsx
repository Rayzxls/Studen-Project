import { notFound, redirect } from "next/navigation";
import { assert } from "@/lib/auth/guards";
import { getCourseOfferingForStudent } from "@/lib/course/queries";
import {
  getAttendanceStatsForStudent,
  getStudentSessionAttendance,
} from "@/lib/attendance/queries";
import { CourseShell } from "@/components/course/course-shell";
import { StudentAttendanceStatsView } from "@/components/attendance/student-stats";
import { studentCourseTabs } from "../_tabs";

// Auth-gated DB-fetching page — skip static prerender.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StudentAttendancePage({ params }: PageProps) {
  const { id } = await params;

  // L1 gate (Pattern 4 / ADR-0013): assert.isActiveCourseMember rejects
  // removed enrollments and non-students; the returned enrollment shape
  // confirms membership for the lib queries below.
  let guard;
  try {
    guard = await assert.isActiveCourseMember(id);
  } catch {
    redirect("/dashboard");
  }

  const [course, stats, sessions] = await Promise.all([
    getCourseOfferingForStudent(id, guard.session.user.id),
    getAttendanceStatsForStudent({
      courseOfferingId: id,
      studentUserId: guard.session.user.id,
    }),
    getStudentSessionAttendance({
      courseOfferingId: id,
      studentUserId: guard.session.user.id,
    }),
  ]);
  if (!course || !stats) notFound();

  return (
    <CourseShell
      course={course}
      eyebrow="ห้องเรียน"
      backHref="/dashboard"
      tabs={studentCourseTabs(id)}
    >
      <StudentAttendanceStatsView stats={stats} sessions={sessions} />
    </CourseShell>
  );
}
