import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, LogIn, BookOpen, Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  listStudentCourses,
  listTeacherCourses,
} from "@/lib/course/enrollment";
import { TopNav } from "@/components/layout/top-nav";

// Auth-gated DB-fetching page — skip static prerender.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      identifier: true,
      createdAt: true,
      admin: { select: { firstName: true, lastName: true } },
      teacher: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          homeroomOf: { select: { name: true } },
        },
      },
      student: {
        select: {
          firstName: true,
          lastName: true,
          studentId: true,
          class: { select: { name: true } },
        },
      },
    },
  });

  if (!user) redirect("/login");

  const name = user.admin
    ? `${user.admin.firstName} ${user.admin.lastName}`
    : user.teacher
      ? `${user.teacher.firstName} ${user.teacher.lastName}`
      : user.student
        ? `${user.student.firstName} ${user.student.lastName}`
        : user.identifier;

  const roleLabel: Record<typeof user.role, string> = {
    ADMIN: "ผู้ดูแลระบบ",
    TEACHER: "ครู",
    STUDENT: "นักเรียน",
  };

  // Role-specific data
  const teacherCourses =
    user.role === "TEACHER" ? await listTeacherCourses(session.user.id) : null;
  const studentCourses =
    user.role === "STUDENT" ? await listStudentCourses(session.user.id) : null;

  return (
    <div className="min-h-screen bg-bg">
      <TopNav session={session} />

      <main className="mx-auto max-w-6xl animate-fade-in px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="badge">{roleLabel[user.role]}</span>
          {user.teacher?.homeroomOf && (
            <span className="badge">
              ครูประจำชั้น {user.teacher.homeroomOf.name}
            </span>
          )}
          {user.student?.class && (
            <span className="badge">{user.student.class.name}</span>
          )}
        </div>

        <h1
          className="text-3xl font-medium text-black md:text-4xl"
          style={{ letterSpacing: "-0.03em" }}
        >
          สวัสดี, {name}
        </h1>
        <p className="mt-2 text-base text-black/60">
          ยินดีต้อนรับเข้าสู่ระบบจัดการห้องเรียน Studennnn
        </p>

        {/* TEACHER */}
        {user.role === "TEACHER" && teacherCourses && (
          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2
                className="text-xl font-medium text-black"
                style={{ letterSpacing: "-0.02em" }}
              >
                วิชาที่สอน ({teacherCourses.length})
              </h2>
              <Link href="/teacher/courses/new" className="btn-primary btn-sm">
                <Plus className="h-4 w-4" />
                สร้างวิชา
              </Link>
            </div>

            {teacherCourses.length === 0 ? (
              <div className="card-flat p-8 text-center">
                <BookOpen className="mx-auto mb-3 h-10 w-10 text-black/20" />
                <p className="text-sm text-black/60">
                  ยังไม่มีวิชาที่สอน — กดสร้างวิชาแรก
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {teacherCourses.slice(0, 6).map((c) => (
                  <Link
                    key={c.id}
                    href={`/teacher/courses/${c.id}`}
                    className="card p-5 hover:no-underline"
                  >
                    <h3
                      className="font-medium text-black"
                      style={{ letterSpacing: "-0.01em" }}
                    >
                      {c.name}
                    </h3>
                    <p className="mt-0.5 text-sm text-black/60">
                      ห้อง {c.class.name} · {c.term.name}
                    </p>
                    <div className="mt-3 flex items-center justify-between border-t border-black/[0.06] pt-3 text-xs">
                      <span className="font-mono text-black/60">
                        {c.classCode}
                      </span>
                      <span className="inline-flex items-center gap-1 text-black/60">
                        <Users className="h-3.5 w-3.5" />
                        {c._count.enrollments}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {teacherCourses.length > 6 && (
              <Link
                href="/teacher/courses"
                className="mt-4 inline-block text-sm text-black hover:underline"
              >
                ดูทั้งหมด →
              </Link>
            )}
          </section>
        )}

        {/* STUDENT */}
        {user.role === "STUDENT" && studentCourses && (
          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2
                className="text-xl font-medium text-black"
                style={{ letterSpacing: "-0.02em" }}
              >
                ห้องเรียนของฉัน ({studentCourses.length})
              </h2>
              <div className="flex items-center gap-2">
                <Link href="/student/terms" className="btn-ghost btn-sm">
                  ผลการเรียน
                </Link>
                <Link href="/join" className="btn-secondary btn-sm">
                  <LogIn className="h-4 w-4" />
                  เข้าร่วมด้วยรหัส
                </Link>
              </div>
            </div>

            {studentCourses.length === 0 ? (
              <div className="card-flat p-8 text-center">
                <BookOpen className="mx-auto mb-3 h-10 w-10 text-black/20" />
                <p className="text-sm text-black/60">
                  ยังไม่ได้เข้าห้องเรียนใดๆ — ขอรหัสจากครูแล้วกด
                </p>
                <Link href="/join" className="btn-primary mt-4">
                  <LogIn className="h-4 w-4" />
                  เข้าร่วมห้องเรียน
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {studentCourses.map((e) => (
                  <Link
                    key={e.id}
                    href={`/student/courses/${e.course.id}`}
                    className="card p-5 hover:no-underline"
                  >
                    <h3
                      className="font-medium text-black"
                      style={{ letterSpacing: "-0.01em" }}
                    >
                      {e.course.name}
                    </h3>
                    <p className="mt-0.5 text-sm text-black/60">
                      ห้อง {e.course.class.name} · {e.course.term.name}
                    </p>
                    <div className="mt-3 border-t border-black/[0.06] pt-3 text-xs text-black/60">
                      ครู {e.course.teacher.firstName}{" "}
                      {e.course.teacher.lastName}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ADMIN */}
        {user.role === "ADMIN" && (
          <section className="mt-10">
            <h2
              className="mb-4 text-xl font-medium text-black"
              style={{ letterSpacing: "-0.02em" }}
            >
              เครื่องมือผู้ดูแล
            </h2>
            <Link href="/admin/dashboard" className="btn-primary">
              เปิด Admin Panel
            </Link>
            <p className="mt-3 text-sm text-black/60">
              จัดการครู / นักเรียน · นำเข้า CSV · ตรวจ Audit Log
            </p>
          </section>
        )}

        {/* Status footer */}
        <section className="card mt-12 p-6">
          <h2
            className="font-medium text-black"
            style={{ letterSpacing: "-0.02em" }}
          >
            อยู่ระหว่างพัฒนา
          </h2>
          <p className="mt-2 text-sm text-black/60">
            <span className="font-medium text-black">Phase ปัจจุบัน:</span> 5 —
            คะแนน + Term Summary
          </p>
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-black/60">
            <li>
              <span className="text-black/40 line-through">
                Phase 2 — Academic Data + Class Code + Join
              </span>{" "}
              ✓
            </li>
            <li>
              <span className="text-black/40 line-through">
                Phase 3 — สมาชิกห้อง (ละเอียดขึ้น)
              </span>{" "}
              ✓
            </li>
            <li>
              <span className="text-black/40 line-through">
                Phase 4 — เช็คชื่อ
              </span>{" "}
              ✓
            </li>
            <li>Phase 6 — การบ้าน + Comments</li>
            <li>Phase 7 — Feed + Notifications</li>
            <li>Phase 8 — Admin Audit Tools</li>
            <li>Phase 9 — Polish + Hardening</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
