import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, LogIn, BookOpen, Users } from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  listStudentCourses,
  listTeacherCourses,
} from "@/lib/course/enrollment";

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

  const roleBadge: Record<typeof user.role, string> = {
    ADMIN: "badge-admin",
    TEACHER: "badge-teacher",
    STUDENT: "badge-student",
  };

  // Role-specific data
  const teacherCourses =
    user.role === "TEACHER" ? await listTeacherCourses(session.user.id) : null;
  const studentCourses =
    user.role === "STUDENT" ? await listStudentCourses(session.user.id) : null;

  return (
    <div className="mesh-bg min-h-screen">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white">
              S
            </div>
            <span className="font-semibold">Studennnn</span>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="btn-ghost btn-sm">ออกจากระบบ</button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 animate-fade-in">
        <div className="mb-6 flex items-center gap-3">
          <span className={roleBadge[user.role]}>{roleLabel[user.role]}</span>
          {user.teacher?.homeroomOf && (
            <span className="badge-gold">
              ครูประจำชั้น {user.teacher.homeroomOf.name}
            </span>
          )}
          {user.student?.class && (
            <span className="badge-gold">{user.student.class.name}</span>
          )}
        </div>

        <h1 className="text-3xl font-bold tracking-tight">
          สวัสดี, <span className="text-gradient-gold">{name}</span>
        </h1>
        <p className="mt-2 text-ink-soft">
          ยินดีต้อนรับเข้าสู่ระบบจัดการห้องเรียน Studennnn
        </p>

        {/* TEACHER */}
        {user.role === "TEACHER" && teacherCourses && (
          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-tight">
                วิชาที่สอน ({teacherCourses.length})
              </h2>
              <Link href="/teacher/courses/new" className="btn-primary btn-sm">
                <Plus className="h-4 w-4" />
                สร้างวิชา
              </Link>
            </div>

            {teacherCourses.length === 0 ? (
              <div className="card-flat p-8 text-center">
                <BookOpen className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm text-ink-soft">
                  ยังไม่มีวิชาที่สอน — กดสร้างวิชาแรก
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {teacherCourses.slice(0, 6).map((c) => (
                  <Link
                    key={c.id}
                    href={`/teacher/courses/${c.id}`}
                    className="card sheen p-5 hover:no-underline"
                  >
                    <h3 className="font-semibold tracking-tight">{c.name}</h3>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      ห้อง {c.class.name} · {c.term.name}
                    </p>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                      <span className="font-mono text-ink-soft">
                        {c.classCode}
                      </span>
                      <span className="inline-flex items-center gap-1 text-ink-soft">
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
                className="mt-4 inline-block text-sm text-ink hover:underline"
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
              <h2 className="text-xl font-semibold tracking-tight">
                ห้องเรียนของฉัน ({studentCourses.length})
              </h2>
              <Link href="/join" className="btn-secondary btn-sm">
                <LogIn className="h-4 w-4" />
                เข้าร่วมด้วยรหัส
              </Link>
            </div>

            {studentCourses.length === 0 ? (
              <div className="card-flat p-8 text-center">
                <BookOpen className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm text-ink-soft">
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
                  <div key={e.id} className="card sheen p-5">
                    <h3 className="font-semibold tracking-tight">
                      {e.course.name}
                    </h3>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      ห้อง {e.course.class.name} · {e.course.term.name}
                    </p>
                    <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-ink-soft">
                      ครู {e.course.teacher.firstName}{" "}
                      {e.course.teacher.lastName}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ADMIN */}
        {user.role === "ADMIN" && (
          <section className="mt-10 card p-6">
            <h2 className="font-semibold tracking-tight">เครื่องมือผู้ดูแล</h2>
            <p className="mt-2 text-sm text-ink-soft">
              หน้า Admin (รายชื่อครู/นักเรียน, audit log, CSV import)
              จะเสร็จในขั้นถัดไปของ Phase 2
            </p>
          </section>
        )}

        {/* Status footer */}
        <section className="mt-12 card sheen p-6">
          <h2 className="font-semibold tracking-tight">🚧 อยู่ระหว่างพัฒนา</h2>
          <p className="mt-2 text-sm text-ink-soft">
            <strong>Phase ปัจจุบัน:</strong> 2 — Academic Data + Class Code +
            Join
          </p>
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-ink-soft">
            <li>Phase 3 — สมาชิกห้อง (ละเอียดขึ้น)</li>
            <li>Phase 4 — เช็คชื่อ</li>
            <li>Phase 5 — คะแนน + Term Summary</li>
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
