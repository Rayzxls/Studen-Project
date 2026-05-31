import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, BookOpen, Users } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { listTeacherCourses } from "@/lib/course/enrollment";

export default async function TeacherCoursesPage() {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const courses = await listTeacherCourses(session.user.id);

  return (
    <div className="mesh-bg min-h-screen">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/dashboard" className="inline-flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white">
              S
            </div>
            <span className="font-semibold">Studennnn</span>
          </Link>
          <Link href="/teacher/courses/new" className="btn-primary btn-sm">
            <Plus className="h-4 w-4" />
            สร้างวิชาใหม่
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 animate-fade-in">
        <div className="mb-6">
          <div className="badge-teacher mb-2">ครูผู้สอน</div>
          <h1 className="text-3xl font-bold tracking-tight">วิชาที่สอน</h1>
          <p className="mt-1 text-sm text-ink-soft">
            จัดการรายวิชาทั้งหมดของคุณ — สร้างรหัสเข้าห้อง, ดูสมาชิก
          </p>
        </div>

        {courses.length === 0 ? (
          <div className="card-flat p-10 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <h2 className="font-semibold tracking-tight">ยังไม่มีวิชาที่สอน</h2>
            <p className="mt-1 text-sm text-ink-soft">
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
                className="card sheen p-5 hover:no-underline"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="min-w-0">
                    <h3 className="font-semibold tracking-tight">
                      {c.subject.name}
                    </h3>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      ห้อง {c.class.name} · {c.term.name}
                    </p>
                  </div>
                  {c.codeActive ? (
                    <span className="badge-student">เปิดรับ</span>
                  ) : (
                    <span className="badge">ปิดรับ</span>
                  )}
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                  <span className="font-mono text-ink-soft">{c.classCode}</span>
                  <span className="inline-flex items-center gap-1 text-ink-soft">
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
