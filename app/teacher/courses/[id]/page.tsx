import { notFound, redirect } from "next/navigation";
import { Users } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
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

  const fullDateFmt = new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <CourseShell
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

        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2
              className="inline-flex items-center gap-2 font-medium text-black"
              style={{ letterSpacing: "-0.02em" }}
            >
              <Users className="h-4 w-4 text-black/60" />
              สมาชิก ({course.enrollments.length} คน)
            </h2>
          </div>

          {course.enrollments.length === 0 ? (
            <p className="rounded-xl bg-black/[0.04] p-4 text-center text-sm text-black/60">
              ยังไม่มีนักเรียนเข้าร่วม — แชร์รหัสด้านบนให้นักเรียนได้เลย
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>เลขประจำตัว</th>
                  <th>ชื่อ-นามสกุล</th>
                  <th>เข้าร่วมเมื่อ</th>
                </tr>
              </thead>
              <tbody>
                {course.enrollments.map((e) => (
                  <tr key={e.id}>
                    <td className="font-mono text-sm">{e.student.studentId}</td>
                    <td>
                      {e.student.firstName} {e.student.lastName}
                    </td>
                    <td className="text-xs text-black/60">
                      {fullDateFmt.format(e.enrolledAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </CourseShell>
  );
}
