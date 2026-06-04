import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForStudent } from "@/lib/course/queries";
import { CourseShell } from "@/components/course/course-shell";
import { studentCourseTabs } from "./_tabs";

// Auth-gated DB-fetching page — skip static prerender.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StudentCourseOverviewPage({ params }: PageProps) {
  let session;
  try {
    session = await requireRole(["STUDENT"]);
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;
  // L1 gate — returns null if student has no active enrollment.
  const course = await getCourseOfferingForStudent(id, session.user.id);
  if (!course) notFound();

  return (
    <CourseShell
      session={session}
      course={course}
      eyebrow="ห้องเรียน"
      backHref="/dashboard"
      tabs={studentCourseTabs(id)}
    >
      <div className="card p-6">
        <p className="text-sm text-black/60">
          ยินดีต้อนรับสู่ห้องเรียน — ฟีดประกาศ, การบ้าน,
          และคะแนนจะแสดงที่นี่ในเฟสถัดไป
        </p>
      </div>
    </CourseShell>
  );
}
