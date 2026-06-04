import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForStudent } from "@/lib/course/queries";
import { getActiveMembersForStudent } from "@/lib/course/enrollment";
import { CourseShell } from "@/components/course/course-shell";
import { StudentMembersList } from "@/components/course/student-members-list";
import { studentCourseTabs } from "../_tabs";

// Auth-gated DB-fetching page — skip static prerender.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StudentCourseMembersPage({ params }: PageProps) {
  let session;
  try {
    session = await requireRole(["STUDENT"]);
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;
  // L1 gate — same predicate as Overview.
  const course = await getCourseOfferingForStudent(id, session.user.id);
  if (!course) notFound();

  // DB-layer projection — see getActiveMembersForStudent header.
  const members = await getActiveMembersForStudent(id);

  return (
    <CourseShell
      session={session}
      course={course}
      eyebrow="ห้องเรียน"
      backHref="/dashboard"
      tabs={studentCourseTabs(id)}
    >
      <StudentMembersList members={members} />
    </CourseShell>
  );
}
