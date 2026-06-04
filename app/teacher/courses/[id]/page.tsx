import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Users } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { getActiveMembers } from "@/lib/course/enrollment";
import { ClassCodeCard } from "@/components/class-code-card";
import { CourseShell } from "@/components/course/course-shell";
import { teacherCourseTabs } from "./_tabs";

// Auth-gated DB-fetching page — skip static prerender.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseOverviewPage({ params }: PageProps) {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;
  const course = await getCourseOfferingForTeacher(id, session.user.id);
  if (!course) notFound();

  // Active member count — Members tab owns the full list now (P3-5/2).
  const activeMembers = await getActiveMembers(id);

  return (
    <CourseShell
      session={session}
      course={course}
      eyebrow="รายวิชาที่สอน"
      backHref="/teacher/courses"
      tabs={teacherCourseTabs(id)}
    >
      <div className="space-y-6">
        <ClassCodeCard
          classCode={course.classCode}
          courseName={course.name}
          className={course.class.name}
        />

        <Link
          href={`/teacher/courses/${id}/members`}
          className="card group flex items-center justify-between p-5 transition-colors hover:bg-black/[0.02]"
        >
          <div className="flex items-center gap-3">
            <Users className="h-4 w-4 text-black/60" />
            <span className="font-medium text-black">
              สมาชิก {activeMembers.length} คน
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-sm text-black/60 group-hover:text-black">
            ดูทั้งหมด
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      </div>
    </CourseShell>
  );
}
