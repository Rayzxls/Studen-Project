import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, BookOpen, Users } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { listTeacherCourses } from "@/lib/course/enrollment";

function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 256 256"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M 128.005 191.173 C 128.448 156.208 156.93 128 192 128 L 192 64 L 128 64 C 128 99.346 99.346 128 64 128 L 64 192 L 128 192 Z M 192 256 L 64 256 C 28.654 256 0 227.346 0 192 L 0 64 L 64 64 L 64 0 L 192 0 C 227.346 0 256 28.654 256 64 L 256 192 L 192 192 Z" />
    </svg>
  );
}

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
      <header className="border-b border-black/[0.06] bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="inline-flex items-center gap-2">
            <LogoMark className="h-6 w-6 text-black" />
            <span
              className="text-lg font-medium text-black"
              style={{ letterSpacing: "-0.02em" }}
            >
              Studennnn
            </span>
          </Link>
          <Link href="/teacher/courses/new" className="btn-primary btn-sm">
            <Plus className="h-4 w-4" />
            สร้างวิชาใหม่
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl animate-fade-in px-6 py-10">
        <div className="mb-6">
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
          <div className="grid gap-4 md:grid-cols-2">
            {courses.map((c) => (
              <Link
                key={c.id}
                href={`/teacher/courses/${c.id}`}
                className="card p-5 hover:no-underline"
              >
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
                  <span className="badge shrink-0">
                    {c.codeActive ? "เปิดรับ" : "ปิดรับ"}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-black/[0.06] pt-3 text-xs">
                  <span className="font-mono text-black/60">{c.classCode}</span>
                  <span className="inline-flex items-center gap-1 text-black/60">
                    <Users className="h-3.5 w-3.5" />
                    {c._count.enrollments} คน
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
