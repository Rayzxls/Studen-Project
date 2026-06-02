import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Users } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { ClassCodeCard } from "@/components/class-code-card";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseDetailPage({ params }: PageProps) {
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
    <div className="min-h-screen bg-bg">
      <header className="border-b border-black/[0.06] bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/teacher/courses" className="btn-ghost btn-sm">
            <ChevronLeft className="h-4 w-4" />
            กลับ
          </Link>
          <span className="text-xs text-black/60">{course.term.name}</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl animate-fade-in space-y-6 px-6 py-10">
        <div>
          <div className="badge mb-2">รายวิชาที่สอน</div>
          <h1
            className="text-3xl font-medium text-black md:text-4xl"
            style={{ letterSpacing: "-0.03em" }}
          >
            {course.name}
          </h1>
          <p className="mt-1 text-sm text-black/60">
            ห้อง {course.class.name} · {course.gradeLevel} ·{" "}
            {course.creditHours} หน่วยกิต
            {course.subjectCode ? ` · รหัส ${course.subjectCode}` : ""} · สอนโดย{" "}
            {course.teacher.firstName} {course.teacher.lastName}
          </p>
        </div>

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
      </main>
    </div>
  );
}
