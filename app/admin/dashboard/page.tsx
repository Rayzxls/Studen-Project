import Link from "next/link";
import {
  Users,
  GraduationCap,
  BookOpen,
  ScrollText,
  Upload,
  Settings2,
  School2,
} from "lucide-react";
import { db } from "@/lib/db/client";
import { getAdminStats, currentTerm } from "@/lib/dashboard/queries";
import { actionLabel } from "@/lib/audit/label";
import { renderAuditLog } from "@/lib/audit/render";
import { getCourseGradientForClass } from "@/lib/theme/course-color";
import { AnimatedStat } from "@/components/dashboard/animated-stat";
import { EntryStagger } from "@/components/motion/entry-stagger";
import { Tilt3D } from "@/components/motion/tilt-3d";

// Auth-gated DB-fetching page — skip static prerender.
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const term = await currentTerm();
  const stats = await getAdminStats();

  // Class Cards grid scoped to the active academic year (Q6) — Card = Class
  // (homeroom), aggregating across CourseOfferings of the active term.
  const academicYearId = term
    ? (
        await db.term.findUnique({
          where: { id: term.id },
          select: { academicYearId: true },
        })
      )?.academicYearId
    : null;

  const classes = academicYearId
    ? await db.class.findMany({
        where: { academicYearId },
        orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          gradeLevel: true,
          academicYear: { select: { name: true } },
          homeroomTeacher: {
            select: { firstName: true, lastName: true, userId: true },
          },
          _count: { select: { students: true } },
          courses: {
            where: { termId: term?.id ?? "__no_term__" },
            select: {
              id: true,
              teacherId: true,
              _count: {
                select: { enrollments: { where: { removedAt: null } } },
              },
            },
          },
        },
      })
    : [];

  // Recent audit activity (8 rows · sentence-rendered per ADR-0027).
  const recentAuditRows = await db.auditLog.findMany({
    orderBy: { timestamp: "desc" },
    take: 8,
    select: {
      id: true,
      timestamp: true,
      action: true,
      actorRole: true,
      targetType: true,
      targetId: true,
      targetLabel: true,
      reason: true,
      actor: {
        select: {
          identifier: true,
          teacher: { select: { firstName: true, lastName: true } },
          student: { select: { firstName: true, lastName: true } },
          admin: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  const recentAudits = recentAuditRows.map((a) => {
    const actorName = a.actor?.teacher
      ? `${a.actor.teacher.firstName} ${a.actor.teacher.lastName}`
      : a.actor?.student
        ? `${a.actor.student.firstName} ${a.actor.student.lastName}`
        : a.actor?.admin
          ? `${a.actor.admin.firstName} ${a.actor.admin.lastName}`
          : (a.actor?.identifier ?? null);
    return {
      id: a.id,
      timestamp: a.timestamp,
      action: a.action,
      label: actionLabel(a.action as Parameters<typeof actionLabel>[0]),
      sentence: renderAuditLog(a, actorName),
    };
  });

  return (
    <div className="animate-fade-in space-y-6 p-6 md:p-10">
      <div>
        <h1
          className="text-3xl font-medium text-black"
          style={{ letterSpacing: "-0.02em" }}
        >
          ภาพรวมระบบ
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {term
            ? `ปีการศึกษา ${term.academicYearName} · ${term.name}`
            : "ยังไม่ได้ตั้งภาคเรียนปัจจุบัน"}{" "}
          · {stats.classCount} ห้องเรียน · {stats.teacherCount} ครู ·{" "}
          {stats.studentCount} นักเรียน
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Users className="h-5 w-5" />}
          label="ครู"
          value={stats.teacherCount}
          href="/admin/teachers"
        />
        <KpiCard
          icon={<GraduationCap className="h-5 w-5" />}
          label="นักเรียน"
          value={stats.studentCount}
          href="/admin/students"
        />
        <KpiCard
          icon={<BookOpen className="h-5 w-5" />}
          label="ห้องเรียน (ปีปัจจุบัน)"
          value={stats.classCount}
        />
        <KpiCard
          icon={<ScrollText className="h-5 w-5" />}
          label="Critical Audit (7 วันล่าสุด)"
          value={stats.criticalAuditsLast7d}
          href="/admin/audit?tier=CRITICAL"
          critical={stats.criticalAuditsLast7d > 0}
        />
      </div>

      {/* Quick actions */}
      <section className="card p-5">
        <h2 className="font-medium text-black/80">ทางลัด</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/admin/setup" className="btn-primary btn-sm">
            <Settings2 className="h-4 w-4" />
            ตั้งค่าโครงสร้าง
          </Link>
          <Link href="/admin/import/teachers" className="btn-secondary btn-sm">
            <Upload className="h-4 w-4" />
            นำเข้าครูจาก CSV
          </Link>
          <Link href="/admin/audit" className="btn-secondary btn-sm">
            <ScrollText className="h-4 w-4" />
            ดู Audit Log
          </Link>
        </div>
      </section>

      {/* Class Cards grid — Q6 lock: Card = Class (homeroom) */}
      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2
            className="text-lg font-medium text-black"
            style={{ letterSpacing: "-0.02em" }}
          >
            ห้องเรียนทั้งหมด ({classes.length})
          </h2>
          {term && (
            <p className="text-xs text-ink-soft">สถิติคำนวณจาก {term.name}</p>
          )}
        </div>
        {!term ? (
          <EmptyTerm />
        ) : classes.length === 0 ? (
          <EmptyClasses />
        ) : (
          <EntryStagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((c) => {
              const teacherIds = new Set(c.courses.map((co) => co.teacherId));
              const studentSum = c.courses.reduce(
                (acc, co) => acc + co._count.enrollments,
                0
              );
              return (
                <Tilt3D key={c.id} maxDeg={6}>
                  <ClassCard
                    id={c.id}
                    name={c.name}
                    gradeLevel={c.gradeLevel}
                    yearName={c.academicYear.name}
                    homeroom={c.homeroomTeacher}
                    enrolledStudents={c._count.students}
                    courseCount={c.courses.length}
                    teacherCount={teacherIds.size}
                    enrollmentSum={studentSum}
                  />
                </Tilt3D>
              );
            })}
          </EntryStagger>
        )}
      </section>

      {/* Recent activity — sentence rendered */}
      <section className="card p-5">
        <h2
          className="mb-3 text-sm font-medium text-black/80"
          style={{ letterSpacing: "-0.02em" }}
        >
          กิจกรรมล่าสุด
        </h2>
        {recentAudits.length === 0 ? (
          <p className="rounded-xl bg-black/[0.04] p-4 text-center text-sm text-ink-soft">
            ยังไม่มีกิจกรรม
          </p>
        ) : (
          <ul className="-mx-2 divide-y divide-black/[0.06]">
            {recentAudits.map((a) => (
              <li key={a.id} className="px-2 py-2.5 text-xs">
                <p className="text-black/80">{a.sentence}</p>
                <Link
                  href={`/admin/audit/${a.id}`}
                  className="mt-1 inline-block text-[10px] text-blue-600 hover:underline"
                >
                  ดูรายละเอียด →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  href,
  critical,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  href?: string;
  critical?: boolean;
}) {
  const inner = (
    <div
      className={"stat " + (critical ? "ring-2 ring-red-200 bg-red-50/40" : "")}
    >
      <div className="flex items-center gap-2">
        <div
          className={
            "flex h-9 w-9 items-center justify-center rounded-xl " +
            (critical
              ? "bg-red-100 text-red-700"
              : "bg-black/[0.05] text-ink-soft")
          }
        >
          {icon}
        </div>
        <div className="stat-label">{label}</div>
      </div>
      <div className={"stat-value mt-3 " + (critical ? "text-red-700" : "")}>
        <AnimatedStat value={value} />
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block hover:no-underline">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function ClassCard({
  id,
  name,
  gradeLevel,
  yearName,
  homeroom,
  enrolledStudents,
  courseCount,
  teacherCount,
  enrollmentSum,
}: {
  id: string;
  name: string;
  gradeLevel: string;
  yearName: string;
  homeroom: { firstName: string; lastName: string; userId: string } | null;
  enrolledStudents: number;
  courseCount: number;
  teacherCount: number;
  enrollmentSum: number;
}) {
  // ADR-0028 § 8 Gallery Exception — admin /admin/dashboard class cards
  // get full .card-hero treatment regardless of admin's default low-vibrancy
  // setting, because the task here is visual scanning across 30-40 classes.
  const gradient = getCourseGradientForClass(id);
  return (
    <Link
      href={`/admin/classes/${id}`}
      className="card-hero group block focus-visible:outline-none"
      aria-label={`เปิดข้อมูล ${name}`}
    >
      {/* Banner zone — course slot gradient mesh (Phase 11 stand-in for
          photographic asset; Phase 11D may upgrade per ADR-0028 § 2). */}
      <div className="card-hero-banner" style={{ background: gradient }}>
        {/* Frosted year chip — opts in to .glass-nav scope (hero info bar
            per ADR-0028 § 5). */}
        <span className="glass-nav absolute right-3 top-3 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium text-black/70">
          ปี {yearName}
        </span>
        {/* Avatar-overlap circle matching the product owner's reference. */}
        <span className="absolute left-6 -bottom-7 inline-flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-card">
          <School2 className="h-6 w-6 text-black/70" />
        </span>
      </div>

      <div className="card-hero-content pt-10">
        <h3
          className="text-xl font-semibold text-black"
          style={{ letterSpacing: "-0.02em" }}
        >
          {name}
        </h3>
        <p className="mt-0.5 text-xs text-black/40">{gradeLevel}</p>

        {homeroom ? (
          <p className="mt-3 text-xs text-black/70">
            <span className="text-black/40">ครูประจำชั้น:</span>{" "}
            <span className="font-medium text-black">
              {homeroom.firstName} {homeroom.lastName}
            </span>
          </p>
        ) : (
          <p className="mt-3 text-xs text-orange-700">ยังไม่มีครูประจำชั้น</p>
        )}

        {/* Inset stats strip — subordinate surface inside the parent card.
            Matches the bottom KPI strip in the product owner's reference. */}
        <dl className="panel-inset mt-4 grid grid-cols-3 gap-0 text-center">
          <Stat label="นักเรียน" value={enrolledStudents} />
          <Stat label="วิชา" value={courseCount} />
          <Stat label="ครู" value={teacherCount} />
        </dl>
        {enrollmentSum > 0 && (
          <p className="mt-2 text-center text-[10px] text-black/40">
            รวม {enrollmentSum} การลงทะเบียน
          </p>
        )}

        <p className="mt-4 text-right text-xs text-black/40 transition-colors group-hover:text-blue-600">
          ดูข้อมูล →
        </p>
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p
        className="text-xl font-semibold text-black"
        style={{ letterSpacing: "-0.02em" }}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-black/50">{label}</p>
    </div>
  );
}

function EmptyTerm() {
  return (
    <div className="card-tinted card-tinted-orange p-8 text-center">
      <p className="text-sm font-medium">ยังไม่ได้ตั้งภาคเรียนปัจจุบัน</p>
      <p className="mt-1 text-xs opacity-70">
        ไปที่ &ldquo;ตั้งค่าโครงสร้าง&rdquo; เพื่อสร้างปี/ภาคเรียน
      </p>
      <Link href="/admin/setup" className="btn-primary btn-sm mt-3 inline-flex">
        เปิด ตั้งค่าโครงสร้าง
      </Link>
    </div>
  );
}

function EmptyClasses() {
  return (
    <div className="card-flat p-8 text-center">
      <p className="text-sm text-black/60">ยังไม่มีห้องเรียนในปีนี้</p>
      <p className="mt-1 text-xs text-black/40">
        เพิ่มห้องเรียนได้ที่ &ldquo;ตั้งค่าโครงสร้าง → ห้องเรียน&rdquo;
      </p>
    </div>
  );
}
