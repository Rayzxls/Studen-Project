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

import { getStudentTermSnapshot } from "@/lib/scoring/queries";
import { gradeForCourseOffering } from "@/lib/scoring/calc";
import { DEFAULT_GRADE_THRESHOLDS } from "@/lib/scoring/constants";

// Auth-gated DB-fetching page — skip static prerender.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function AdminClassDetailPage({
  params,
  searchParams,
}: PageProps) {
  try {
    await requireRole(["ADMIN"]);
  } catch {
    redirect("/dashboard");
  }
  const { id } = await params;
  const sp = await searchParams;
  const activeTab = sp.tab ?? "roster";

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

  // Attendance calculations
  const attendanceMap = new Map<
    string,
    { PRESENT: number; LATE: number; EXCUSED: number; ABSENT: number }
  >();
  if (activeTab === "attendance" && term && cls.students.length > 0) {
    // Initialize map
    for (const s of cls.students) {
      attendanceMap.set(s.userId, {
        PRESENT: 0,
        LATE: 0,
        EXCUSED: 0,
        ABSENT: 0,
      });
    }

    const courseIds = cls.courses.map((c) => c.id);
    const enrollmentsWithAttendance = await db.enrollment.findMany({
      where: {
        studentId: { in: cls.students.map((s) => s.userId) },
        courseOfferingId: { in: courseIds },
        removedAt: null,
      },
      select: {
        studentId: true,
        attendanceRecords: {
          where: { session: { cancelledAt: null } },
          select: {
            status: true,
          },
        },
      },
    });

    for (const en of enrollmentsWithAttendance) {
      const counts = attendanceMap.get(en.studentId);
      if (counts) {
        for (const rec of en.attendanceRecords) {
          if (rec.status in counts) {
            counts[rec.status]++;
          }
        }
      }
    }
  }

  // Per-course grade calculations — admin sees per-course grades only,
  // never a Term GPA rollup (CONTEXT § Learning Results: "เกรด" = เกรดรายวิชา).
  let gradesData: {
    userId: string;
    courseGrades: Map<string, { grade: number | null; percent: number | null }>;
  }[] = [];

  if (activeTab === "grades" && term && cls.students.length > 0) {
    gradesData = await Promise.all(
      cls.students.map(async (s) => {
        const snapshot = await getStudentTermSnapshot(s.userId, term.id);

        const courseGrades = new Map<
          string,
          { grade: number | null; percent: number | null }
        >();
        for (let i = 0; i < snapshot.rows.length; i++) {
          const r = snapshot.rows[i]!;
          const b = snapshot.bundles[i]!;

          let thresholds = DEFAULT_GRADE_THRESHOLDS;
          if (r.gradeRulesJson && Array.isArray(r.gradeRulesJson)) {
            try {
              const parsed = [];
              for (const item of r.gradeRulesJson) {
                if (
                  item &&
                  typeof item === "object" &&
                  "minPercent" in item &&
                  "grade" in item
                ) {
                  parsed.push({
                    minPercent: Number(item.minPercent),
                    grade: Number(item.grade),
                  });
                }
              }
              if (parsed.length > 0) {
                thresholds = parsed.sort((a, b) => b.minPercent - a.minPercent);
              }
            } catch (_) {}
          }

          const res = gradeForCourseOffering(b.items, b.entries, thresholds);
          courseGrades.set(r.courseOfferingId, {
            grade: res.grade,
            percent: res.percent,
          });
        }

        return {
          userId: s.userId,
          courseGrades,
        };
      })
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <Link
        href="/admin/dashboard"
        className="inline-flex items-center gap-1 text-xs text-black/60 hover:text-black"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        กลับไปหน้าภาพรวม
      </Link>

      <header
        className="relative overflow-hidden rounded-3xl bg-white"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        {/* ═══ Immersive Classroom Banner ═══ */}
        <div className="relative" style={{ minHeight: "220px" }}>
          {/* 3D Classroom Background — full-bleed */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "url(/brand/classroom-bg.webp)",
              backgroundSize: "cover",
              backgroundPosition: "center 40%",
              filter: "brightness(0.85) saturate(1.2)",
            }}
          />
          {/* Gradient overlay for text readability */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 50%, transparent 100%)",
            }}
          />
          {/* Bottom fade for seamless blend into white card */}
          <div
            className="absolute inset-x-0 bottom-0 h-24"
            style={{
              background:
                "linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0.8) 40%, transparent 100%)",
            }}
          />

          {/* Content row: text left, mascot right */}
          <div
            className="relative z-10 flex items-end justify-between px-6 pt-6 pb-0"
            style={{ minHeight: "180px" }}
          >
            {/* Left: class info */}
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 shadow-card backdrop-blur">
                  <School2 className="h-5 w-5 text-black/70" />
                </div>
                <div>
                  <h1
                    className="text-2xl font-semibold text-white drop-shadow-lg"
                    style={{
                      letterSpacing: "-0.02em",
                      textShadow: "0 2px 12px rgba(0,0,0,0.4)",
                    }}
                  >
                    {cls.name}
                  </h1>
                  <p className="mt-0.5 text-xs text-white/80 drop-shadow">
                    {cls.gradeLevel} · ปีการศึกษา {cls.academicYear.name}
                  </p>
                </div>
              </div>
              {cls.homeroomTeacher && (
                <div className="mt-3">
                  <Link
                    href={`/admin/users/${cls.homeroomTeacher.userId}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white/90 px-3 py-1.5 text-xs font-medium text-black/80 shadow-lift backdrop-blur transition-all hover:bg-white hover:shadow-card"
                  >
                    ดูครูประจำชั้น →
                  </Link>
                </div>
              )}
            </div>

            {/* Right: 3D Student Mascot — blended with the classroom scene */}
            <div
              className="hidden sm:block flex-shrink-0 -mb-1"
              style={{ width: "160px", marginRight: "-8px" }}
            >
              <img
                src="/brand/student-mascot-transparent.webp"
                alt="Student Mascot"
                className="w-full h-auto"
                style={{
                  filter: "drop-shadow(0 4px 24px rgba(0,0,0,0.3))",
                  transform: "translateY(4px)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Stats row — sits inside the white zone */}
        <div className="px-6 pb-5 -mt-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

      {/* Tabs navigation */}
      <div className="flex justify-start">
        <nav className="inline-flex gap-1 rounded-2xl bg-black/[0.04] p-1 shadow-inner">
          <Link
            href={`/admin/classes/${cls.id}?tab=roster`}
            className={`rounded-xl px-4 py-1.5 text-xs md:text-sm font-medium transition-all ${
              activeTab === "roster"
                ? "bg-white text-black shadow-lift"
                : "text-black/65 hover:text-black"
            }`}
          >
            ภาพรวมห้องเรียน
          </Link>
          <Link
            href={`/admin/classes/${cls.id}?tab=attendance`}
            className={`rounded-xl px-4 py-1.5 text-xs md:text-sm font-medium transition-all ${
              activeTab === "attendance"
                ? "bg-white text-black shadow-lift"
                : "text-black/65 hover:text-black"
            }`}
          >
            สถิติการเข้าเรียน
          </Link>
          <Link
            href={`/admin/classes/${cls.id}?tab=grades`}
            className={`rounded-xl px-4 py-1.5 text-xs md:text-sm font-medium transition-all ${
              activeTab === "grades"
                ? "bg-white text-black shadow-lift"
                : "text-black/65 hover:text-black"
            }`}
          >
            เกรดและคะแนนสอบ
          </Link>
        </nav>
      </div>

      {activeTab === "roster" && (
        <>
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
              <p className="text-xs text-black/40">
                ยังไม่มีวิชาที่เปิดในเทอมนี้
              </p>
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
        </>
      )}

      {activeTab === "attendance" && (
        <section className="card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-medium text-black/80">
            <ClipboardList className="h-4 w-4" />
            สถิติการเข้าเรียนสะสม (แยกรายบุคคล)
          </h2>
          {cls.students.length === 0 ? (
            <p className="text-xs text-black/40 text-center py-6">
              ยังไม่มีนักเรียนในห้องเรียนนี้
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="table w-full text-left">
                <thead>
                  <tr className="bg-slate-50/60 text-xs text-black/55">
                    <th className="px-4 py-2.5">เลขประจำตัว</th>
                    <th className="px-4 py-2.5">ชื่อ-นามสกุล</th>
                    <th className="px-4 py-2.5 text-center">มา (คาบ)</th>
                    <th className="px-4 py-2.5 text-center">สาย (คาบ)</th>
                    <th className="px-4 py-2.5 text-center">ลา (คาบ)</th>
                    <th className="px-4 py-2.5 text-center">ขาด (คาบ)</th>
                    <th className="px-4 py-2.5 text-right">
                      ร้อยละการเข้าเรียน
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {cls.students.map((s) => {
                    const counts = attendanceMap.get(s.userId) ?? {
                      PRESENT: 0,
                      LATE: 0,
                      EXCUSED: 0,
                      ABSENT: 0,
                    };
                    const marked =
                      counts.PRESENT +
                      counts.LATE +
                      counts.EXCUSED +
                      counts.ABSENT;
                    const attRate =
                      marked > 0
                        ? Math.round(
                            ((counts.PRESENT + counts.LATE) / marked) * 100
                          )
                        : null;

                    return (
                      <tr key={s.userId} className="hover:bg-slate-50/40">
                        <td className="px-4 py-3 font-mono text-black/70">
                          {s.studentId}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/users/${s.userId}`}
                            className="font-medium text-black hover:underline"
                          >
                            {s.firstName} {s.lastName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-center text-green-700 font-medium">
                          {counts.PRESENT}
                        </td>
                        <td className="px-4 py-3 text-center text-orange-600">
                          {counts.LATE}
                        </td>
                        <td className="px-4 py-3 text-center text-blue-600">
                          {counts.EXCUSED}
                        </td>
                        <td className="px-4 py-3 text-center text-red-600 font-medium">
                          {counts.ABSENT}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`px-2 py-0.5 rounded-full font-semibold ${
                              attRate !== null
                                ? attRate >= 80
                                  ? "bg-green-50 text-green-700 ring-1 ring-green-600/10"
                                  : attRate >= 50
                                    ? "bg-orange-50 text-orange-700 ring-1 ring-orange-600/10"
                                    : "bg-red-50 text-red-700 ring-1 ring-red-600/10"
                                : "bg-slate-50 text-slate-500"
                            }`}
                          >
                            {attRate !== null ? `${attRate}%` : "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === "grades" && (
        <section className="card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-medium text-black/80">
            <ClipboardList className="h-4 w-4" />
            ตารางคะแนนและเกรดรายวิชา
          </h2>
          {cls.students.length === 0 ? (
            <p className="text-xs text-black/40 text-center py-6">
              ยังไม่มีนักเรียนในห้องเรียนนี้
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="table w-full text-left">
                <thead>
                  <tr className="bg-slate-50/60 text-xs text-black/55">
                    <th className="px-4 py-2.5">เลขประจำตัว</th>
                    <th className="px-4 py-2.5">ชื่อ-นามสกุล</th>
                    {courses.map((c) => (
                      <th
                        key={c.id}
                        className="px-4 py-2.5 text-right font-medium"
                      >
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {cls.students.map((s) => {
                    const studentGrade = gradesData.find(
                      (g) => g.userId === s.userId
                    );
                    return (
                      <tr key={s.userId} className="hover:bg-slate-50/40">
                        <td className="px-4 py-3 font-mono text-black/70">
                          {s.studentId}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/users/${s.userId}`}
                            className="font-medium text-black hover:underline"
                          >
                            {s.firstName} {s.lastName}
                          </Link>
                        </td>
                        {courses.map((c) => {
                          const gradeDetail = studentGrade?.courseGrades.get(
                            c.id
                          );
                          return (
                            <td key={c.id} className="px-4 py-3 text-right">
                              {gradeDetail && gradeDetail.grade !== null ? (
                                <span>
                                  <span className="font-semibold text-blue-600">
                                    {gradeDetail.grade.toFixed(1)}
                                  </span>{" "}
                                  <span className="text-[10px] text-black/45">
                                    ({Math.round(gradeDetail.percent!)}%)
                                  </span>
                                </span>
                              ) : (
                                <span className="text-black/35">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

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
