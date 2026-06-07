import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { getActiveMembers } from "@/lib/course/enrollment";
import { CourseShell } from "@/components/course/course-shell";
import { MembersTable } from "@/components/course/members-table";
import { teacherCourseTabs } from "../_tabs";

// Auth-gated DB-fetching page — skip static prerender.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseMembersPage({ params }: PageProps) {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;
  const course = await getCourseOfferingForTeacher(id, session.user.id);
  if (!course) notFound();

  const members = await getActiveMembers(id);

  return (
    <CourseShell
      session={session}
      course={course}
      eyebrow="รายวิชาที่สอน"
      backHref="/teacher/courses"
      tabs={teacherCourseTabs(id)}
    >
      <MembersTable courseId={id} members={members} />
    </CourseShell>
  );
}
