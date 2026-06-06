import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, BookOpen, Users } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { listTeacherCourses } from "@/lib/course/enrollment";
import { TopNav } from "@/components/layout/top-nav";
import { CourseColorChip } from "@/components/course/course-color-chip";
import { EntryStagger } from "@/components/motion/entry-stagger";
import { Tilt3D } from "@/components/motion/tilt-3d";

// Auth-gated DB-fetching page — skip static prerender.
export const dynamic = "force-dynamic";

export default async function TeacherCoursesPage() {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const courses = await listTeacherCourses(session.user.id);

  return (
    <div className="min-h-screen bg-bg">
      <TopNav session={session} />

      <main className="mx-auto max-w-6xl animate-fade-in px-6 py-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="badge mb-2">ครูผู้สอน</div>
            <h1
              className="text-3xl font-medium text-black md:text-4xl"
              style={{ letterSpacing: "-0.03em" }}
            >
              วิชาที่สอน
            </h1>
            <p className="mt-1 text-sm text-black/60">
              จัดการรายวิชาทั้งหมดของคุณ — สร้างรหัสเข้าห้อง, ดูสมาชิก
            </p>
          </div>
          <Link href="/teacher/courses/new" className="btn-primary btn-sm">
            <Plus className="h-4 w-4" />
            สร้างวิชาใหม่
          </Link>
        </div>

        {courses.length === 0 ? (
          <div className="card-flat p-10 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-black/20" />
            <h2
              className="font-medium text-black"
              style={{ letterSpacing: "-0.02em" }}
            >
              ยังไม่มีวิชาที่สอน
            </h2>
            <p className="mt-1 text-sm text-black/60">
              เริ่มต้นด้วยการสร้างวิชาแรกของคุณ
            </p>
            <Link href="/teacher/courses/new" className="btn-primary mt-5">
              <Plus className="h-4 w-4" />
              สร้างวิชาใหม่
            </Link>
          </div>
        ) : (
          <EntryStagger className="grid gap-4 md:grid-cols-2">
            {courses.map((c) => (
              <Tilt3D key={c.id} maxDeg={6}>
                <Link
                  href={`/teacher/courses/${c.id}`}
                  className="card relative flex p-5 hover:no-underline"
                >
                  {/* Teacher list — 4px course colour marker (ADR-0028 § 8). */}
                  <CourseColorChip
                    classId={c.class.id}
                    variant="marker"
                    className="mr-4"
                  />
                  <div className="flex-1">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3
                          className="font-medium text-black"
                          style={{ letterSpacing: "-0.01em" }}
                        >
                          {c.name}
                        </h3>
                        <p className="mt-0.5 text-sm text-black/60">
                          ห้อง {c.class.name} · {c.term.name} · {c.creditHours}{" "}
                          หน่วยกิต
                        </p>
                      </div>
                      <span
                        className={
                          "shrink-0 " +
                          (c.codeActive ? "badge-info badge" : "badge")
                        }
                      >
                        {c.codeActive ? "เปิดรับ" : "ปิดรับ"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-black/[0.06] pt-3 text-xs">
                      <span className="font-mono text-black/60">
                        {c.classCode}
                      </span>
                      <span className="inline-flex items-center gap-1 text-black/60">
                        <Users className="h-3.5 w-3.5" />
                        {c._count.enrollments} คน
                      </span>
                    </div>
                  </div>
                </Link>
              </Tilt3D>
            ))}
          </EntryStagger>
        )}
      </main>
    </div>
  );
}
