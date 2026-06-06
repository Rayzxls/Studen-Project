import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ChevronLeft,
  ClipboardList,
  GraduationCap,
  School2,
} from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { currentTerm } from "@/lib/dashboard/queries";
import { getCourseGradientForClass } from "@/lib/theme/course-color";

// Auth-gated DB-fetching page — skip static prerender.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminClassDetailPage({ params }: PageProps) {
  try {
    await requireRole(["ADMIN"]);
  } catch {
    redirect("/dashboard");
  }
  const { id } = await params;

  const term = await currentTerm();

  const cls = await db.class.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      gradeLevel: true,
      academicYear: { select: { name: true } },
      homeroomTeacher: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      students: {
        select: {
          userId: true,
          studentId: true,
          firstName: true,
          lastName: true,
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      },
      courses: {
        where: { termId: term?.id ?? "__no_term__" },
        select: {
          id: true,
          name: true,
          subjectCode: true,
          creditHours: true,
          teacher: {
            select: {
              userId: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          _count: {
            select: {
              enrollments: { where: { removedAt: null } },
              scoreItems: true,
              assignments: true,
            },
          },
        },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!cls) notFound();

  const courses = cls.courses;
  const teacherCount = new Set(courses.map((c) => c.teacher.userId)).size;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <Link
        href="/admin/dashboard"
        className="inline-flex items-center gap-1 text-xs text-black/60 hover:text-black"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        กลับไปหน้าภาพรวม
      </Link>

      <header className="card-hero">
        {/* Banner zone — course slot gradient mesh, same hash input as
            /admin/dashboard so this drill-down inherits the colour from
            the gallery card the admin clicked. */}
        <div
          className="card-hero-banner"
          style={{ background: getCourseGradientForClass(cls.id) }}
        />
        <div className="card-hero-content -mt-12 relative">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-card">
                  <School2 className="h-5 w-5 text-black/70" />
                </div>
                <div>
                  <h1
                    className="text-2xl font-medium text-black"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {cls.name}
                  </h1>
                  <p className="mt-0.5 text-xs text-black/50">
                    {cls.gradeLevel} · ปีการศึกษา {cls.academicYear.name}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {cls.homeroomTeacher && (
                <Link
                  href={`/admin/users/${cls.homeroomTeacher.userId}`}
                  className="btn-secondary btn-sm"
                >
                  ดูครูประจำชั้น →
                </Link>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="นักเรียน" value={cls.students.length} />
            <Stat label="วิชาที่เปิดในเทอมนี้" value={courses.length} />
            <Stat label="ครูที่สอนวิชา" value={teacherCount} />
            <Stat
              label="ครูประจำชั้น"
              value={cls.homeroomTeacher ? 1 : 0}
              text={
                cls.homeroomTeacher
                  ? `${cls.homeroomTeacher.firstName} ${cls.homeroomTeacher.lastName}`
                  : "—"
              }
            />
          </div>
        </div>
      </header>

      {/* Courses */}
      <section className="card p-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-black/80">
          <ClipboardList className="h-4 w-4" />
          วิชาที่เปิดในเทอมนี้ ({courses.length})
        </h2>
        {!term ? (
          <p className="text-xs text-orange-700">
            ยังไม่ได้ตั้งภาคเรียนปัจจุบัน
          </p>
        ) : courses.length === 0 ? (
          <p className="text-xs text-black/40">ยังไม่มีวิชาที่เปิดในเทอมนี้</p>
        ) : (
          <ul className="divide-y divide-black/[0.06]">
            {courses.map((c) => (
              <li key={c.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-black">
                      {c.name}
                      {c.subjectCode && (
                        <span className="ml-2 font-mono text-[10px] text-black/40">
                          {c.subjectCode}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-black/50">
                      ครู{" "}
                      <Link
                        href={`/admin/users/${c.teacher.userId}`}
                        className="font-medium text-black hover:underline"
                      >
                        {c.teacher.firstName} {c.teacher.lastName}
                      </Link>{" "}
                      · {c.creditHours} หน่วยกิต · {c._count.enrollments}{" "}
                      นักเรียน · {c._count.scoreItems} รายการคะแนน ·{" "}
                      {c._count.assignments} การบ้าน
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Roster */}
      <section className="card p-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-black/80">
          <GraduationCap className="h-4 w-4" />
          นักเรียนในห้อง ({cls.students.length})
        </h2>
        {cls.students.length === 0 ? (
          <p className="text-xs text-black/40">ยังไม่มีนักเรียน</p>
        ) : (
          <ul className="divide-y divide-black/[0.06] text-sm">
            {cls.students.map((s) => (
              <li
                key={s.userId}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div>
                  <Link
                    href={`/admin/users/${s.userId}`}
                    className="font-medium text-black hover:underline"
                  >
                    {s.firstName} {s.lastName}
                  </Link>
                  <p className="text-[10px] font-mono text-black/40">
                    {s.studentId}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[10px] text-black/30 text-center">
        การจัดอันดับคะแนน / สถิติการเข้าเรียน + CSV export จะเปิดในเฟสถัดไป
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  text,
}: {
  label: string;
  value: number;
  text?: string;
}) {
  return (
    <div className="rounded-xl bg-white/80 p-3 text-center shadow-soft backdrop-blur">
      <p className="text-2xl font-medium text-black">
        {value.toLocaleString("th-TH")}
      </p>
      <p className="text-[10px] text-black/40">{label}</p>
      {text && <p className="mt-0.5 truncate text-xs text-black/60">{text}</p>}
    </div>
  );
}
