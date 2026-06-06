import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Plus, LogIn, BookOpen, Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  listStudentCourses,
  listTeacherCourses,
} from "@/lib/course/enrollment";
import { TopNav } from "@/components/layout/top-nav";
import { StudentBottomNav } from "@/components/layout/student-bottom-nav";
import { DueSoonWidget } from "@/components/feed/due-soon-widget";
import { UserFeed } from "@/components/feed/user-feed";
import { CourseColorChip } from "@/components/course/course-color-chip";
import { TeacherHero } from "@/components/dashboard/teacher-hero";
import { StudentTodayPanel } from "@/components/dashboard/student-today-panel";
import { AmbientBackground } from "@/components/motion/ambient-background";
import { EntryStagger } from "@/components/motion/entry-stagger";
import { Tilt3D } from "@/components/motion/tilt-3d";

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
        {/* Student gets the .card-hero blue saturated greeting — the
            third critical sweep per ADR-0028 § 4. Teacher and admin
            keep the calm text greeting (Phase 11D will deepen teacher). */}
        {user.role === "STUDENT" ? (
          <section
            className="card-accent card-accent-blue relative overflow-hidden rounded-3xl"
            style={{
              padding: "32px",
              minHeight: 200,
            }}
          >
            {/* Ambient drifting blobs (ADR-0029 T2) add living depth
                behind the saturated hero without hurting white-text
                contrast — they sit under a darkening overlay. */}
            <AmbientBackground tone="blue" intensity={0.55} />
            {/* Subtle radial highlight in the top-right adds the iOS
                pressed-glass depth without changing the saturated read. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 90% 0%, rgba(255,255,255,0.22) 0%, transparent 55%), linear-gradient(180deg, rgba(10,132,255,0.0) 40%, rgba(10,132,255,0.35) 100%)",
              }}
            />
            <div className="relative z-10 flex h-full flex-col gap-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white">
                  {roleLabel[user.role]}
                </span>
                {user.student?.class && (
                  <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white">
                    {user.student.class.name}
                  </span>
                )}
              </div>

              <div>
                <h1
                  className="text-3xl font-semibold text-white md:text-4xl"
                  style={{ letterSpacing: "-0.03em" }}
                >
                  สวัสดี, {name}
                </h1>
                <p className="mt-2 text-base text-white/80">
                  ยินดีต้อนรับเข้าสู่ระบบจัดการห้องเรียน Studennnn
                </p>
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-2">
                <Link
                  href="/join"
                  className="inline-flex items-center gap-2 rounded-full bg-white py-2 pl-5 pr-2 text-sm font-medium text-blue-700 transition-transform hover:scale-[0.99]"
                >
                  เข้าร่วมห้องเรียน
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
                <Link
                  href="/student/terms"
                  className="rounded-full bg-white/15 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-white/25"
                >
                  ผลการเรียน
                </Link>
              </div>
            </div>
          </section>
        ) : user.role === "TEACHER" ? (
          <>
            {user.teacher?.homeroomOf && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="badge">
                  ครูประจำชั้น {user.teacher.homeroomOf.name}
                </span>
              </div>
            )}
            <TeacherHero teacherUserId={session.user.id} name={name} />
          </>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <span className="badge">{roleLabel[user.role]}</span>
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
          </>
        )}

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
              <EntryStagger className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {teacherCourses.slice(0, 6).map((c) => (
                  <Tilt3D key={c.id} maxDeg={6}>
                    <Link
                      href={`/teacher/courses/${c.id}`}
                      className="card group relative flex p-5 hover:no-underline"
                    >
                      {/* Teacher view — 4px course colour marker per ADR-0028 § 8. */}
                      <CourseColorChip
                        classId={c.class.id}
                        variant="marker"
                        className="mr-4"
                      />
                      <div className="flex-1">
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
                      </div>
                    </Link>
                  </Tilt3D>
                ))}
              </EntryStagger>
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

        {/* STUDENT — Today's class panel (Phase 11D) + Due Soon. */}
        {user.role === "STUDENT" && (
          <div className="mt-10 space-y-4">
            <StudentTodayPanel studentUserId={session.user.id} />
            <DueSoonWidget studentUserId={session.user.id} />
          </div>
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
              <EntryStagger className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {studentCourses.map((e) => (
                  <Tilt3D key={e.id} maxDeg={7}>
                    <Link
                      href={`/student/courses/${e.course.id}`}
                      className="card block p-5 hover:no-underline"
                    >
                      {/* Student view — full course colour chip per ADR-0028 § 8. */}
                      <CourseColorChip
                        classId={e.course.class.id}
                        variant="chip"
                        label={e.course.class.name}
                        className="mb-3"
                      />
                      <h3
                        className="font-medium text-black"
                        style={{ letterSpacing: "-0.01em" }}
                      >
                        {e.course.name}
                      </h3>
                      <p className="mt-0.5 text-sm text-black/60">
                        {e.course.term.name}
                      </p>
                      <div className="mt-3 border-t border-black/[0.06] pt-3 text-xs text-black/60">
                        ครู {e.course.teacher.firstName}{" "}
                        {e.course.teacher.lastName}
                      </div>
                    </Link>
                  </Tilt3D>
                ))}
              </EntryStagger>
            )}
          </section>
        )}

        {/* STUDENT — User Feed (Q3 = B: student-only) */}
        {user.role === "STUDENT" && (
          <div className="mt-10">
            <UserFeed session={session} />
          </div>
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

        {/* Bottom-padding spacer so the last card clears the mobile
            glass bottom nav (only mounted for STUDENT). */}
        {user.role === "STUDENT" && <div className="h-20 md:hidden" />}
      </main>

      {/* Student mobile glass bottom nav — ADR-0028 § 5. */}
      {user.role === "STUDENT" && <StudentBottomNav />}
    </div>
  );
}
