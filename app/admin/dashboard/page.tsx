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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((c) => {
              const teacherIds = new Set(c.courses.map((co) => co.teacherId));
              const studentSum = c.courses.reduce(
                (acc, co) => acc + co._count.enrollments,
                0
              );
              return (
                <ClassCard
                  key={c.id}
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
              );
            })}
          </div>
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
      className={
        "stat " + (critical ? "ring-2 ring-rose-200 bg-rose-50/30" : "")
      }
    >
      <div className="flex items-center gap-2">
        <div
          className={
            "flex h-9 w-9 items-center justify-center rounded-xl text-ink-soft " +
            (critical ? "bg-rose-100 text-rose-700" : "bg-black/[0.05]")
          }
        >
          {icon}
        </div>
        <div className="stat-label">{label}</div>
      </div>
      <div className="stat-value mt-3">{value.toLocaleString("th-TH")}</div>
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
  return (
    <Link
      href={`/admin/classes/${id}`}
      className="card group relative overflow-hidden p-5 transition-all hover:shadow-lift hover:-translate-y-0.5"
    >
      {/* Cover */}
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-br from-amber-100 to-amber-50" />
      <div className="absolute right-3 top-3 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-black/60 backdrop-blur">
        ปี {yearName}
      </div>
      <div className="relative z-10 mt-12">
        <div className="flex items-center gap-2">
          <School2 className="h-5 w-5 text-amber-700" />
          <h3 className="text-lg font-medium text-black">{name}</h3>
        </div>
        <p className="mt-0.5 text-xs text-black/40">{gradeLevel}</p>

        <div className="mt-3 rounded-xl bg-black/[0.03] p-3">
          {homeroom ? (
            <p className="text-xs text-black/70">
              <span className="text-black/40">ครูประจำชั้น:</span>{" "}
              <span className="font-medium text-black">
                {homeroom.firstName} {homeroom.lastName}
              </span>
            </p>
          ) : (
            <p className="text-xs text-amber-700">— ยังไม่มีครูประจำชั้น</p>
          )}
        </div>

        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="นักเรียน" value={enrolledStudents} />
          <Stat label="วิชา" value={courseCount} />
          <Stat label="ครู" value={teacherCount} />
        </dl>
        {enrollmentSum > 0 && (
          <p className="mt-2 text-center text-[10px] text-black/40">
            รวม {enrollmentSum} การลงทะเบียน
          </p>
        )}

        <p className="mt-3 text-right text-xs text-black/40 group-hover:text-black/70">
          ดูข้อมูล →
        </p>
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-base font-medium text-black">{value}</p>
      <p className="text-[10px] text-black/40">{label}</p>
    </div>
  );
}

function EmptyTerm() {
  return (
    <div className="card-flat p-8 text-center">
      <p className="text-sm text-amber-700">ยังไม่ได้ตั้งภาคเรียนปัจจุบัน</p>
      <p className="mt-1 text-xs text-black/40">
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
