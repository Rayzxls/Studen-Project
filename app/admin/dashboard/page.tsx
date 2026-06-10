import Image from "next/image";
import Link from "next/link";
import {
  Users,
  GraduationCap,
  BookOpen,
  ScrollText,
  Upload,
  Settings2,
  Activity,
  AlertTriangle,
  KeyRound,
} from "lucide-react";
import { db } from "@/lib/db/client";
import { getAdminStats, currentTerm } from "@/lib/dashboard/queries";
import { getCourseSlotColors } from "@/lib/theme/course-color";
import { ActionRow, MetricTile } from "@/components/dashboard/primitives";
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

  // Operational alerts — short, actionable, never a feed (CONTEXT decision:
  // no activity timeline on the admin dashboard; the browsing surface is
  // /admin/activity, the security trail is /admin/audit).
  const alerts: { key: string; text: string; href: string; label: string }[] =
    [];
  if (stats.criticalAuditsLast7d > 0) {
    alerts.push({
      key: "critical-audits",
      text: `มีเหตุการณ์ระดับ Critical ${stats.criticalAuditsLast7d} รายการใน 7 วันล่าสุด`,
      href: "/admin/audit?tier=CRITICAL",
      label: "เปิด Audit Log",
    });
  }
  if (!term) {
    alerts.push({
      key: "no-term",
      text: "ยังไม่ได้ตั้งภาคเรียนปัจจุบัน — ครูจะยังสร้างวิชาไม่ได้",
      href: "/admin/setup",
      label: "ตั้งค่าโครงสร้าง",
    });
  }
  if (stats.teacherCount === 0) {
    alerts.push({
      key: "no-teachers",
      text: "ยังไม่มีบัญชีครูในระบบ",
      href: "/admin/import/teachers",
      label: "นำเข้าครูจาก CSV",
    });
  }

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

      {/* Operational alerts — only when something needs attention. */}
      {alerts.length > 0 && (
        <section
          className="rounded-2xl bg-red-50/70 p-2 ring-1 ring-red-500/15"
          aria-label="สิ่งที่ต้องระวัง"
        >
          <ul className="divide-y divide-red-500/10">
            {alerts.map((a) => (
              <li
                key={a.key}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
              >
                <span className="inline-flex items-center gap-2 text-sm text-red-900">
                  <AlertTriangle
                    className="h-4 w-4 shrink-0 text-red-500"
                    aria-hidden="true"
                  />
                  {a.text}
                </span>
                <Link
                  href={a.href}
                  className="text-xs font-semibold text-red-700 hover:underline"
                >
                  {a.label} →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* System KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          icon={Users}
          label="ครู"
          value={stats.teacherCount}
          suffix="คน"
          href="/admin/teachers"
          tone="blue"
        />
        <MetricTile
          icon={GraduationCap}
          label="นักเรียน"
          value={stats.studentCount}
          suffix="คน"
          href="/admin/students"
          tone="blue"
        />
        <MetricTile
          icon={BookOpen}
          label="ห้องเรียน (ปีปัจจุบัน)"
          value={stats.classCount}
          suffix="ห้อง"
        />
        <MetricTile
          icon={ScrollText}
          label="Critical Audit (7 วัน)"
          value={stats.criticalAuditsLast7d}
          suffix="รายการ"
          href="/admin/audit?tier=CRITICAL"
          tone={stats.criticalAuditsLast7d > 0 ? "red" : "green"}
        />
      </div>

      {/* Admin tasks + review surfaces */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2
            className="text-base font-semibold text-black"
            style={{ letterSpacing: "-0.01em" }}
          >
            งานผู้ดูแล
          </h2>
          <div className="-mx-3 mt-2">
            <ActionRow
              href="/admin/setup"
              title="ตั้งค่าโครงสร้าง"
              meta="ปีการศึกษา · ภาคเรียน · ห้องเรียน · เพิ่มครูรายคน"
              leading={<IconChip icon={<Settings2 className="h-4 w-4" />} />}
            />
            <ActionRow
              href="/admin/import/teachers"
              title="นำเข้าครูจาก CSV"
              meta="สร้างบัญชีครูเป็นชุด พร้อมรหัสผ่านชั่วคราว"
              leading={<IconChip icon={<Upload className="h-4 w-4" />} />}
            />
            <ActionRow
              href="/admin/teachers"
              title="รีเซ็ตรหัสผ่าน"
              meta="เลือกครู/นักเรียนจากรายชื่อ แล้วรีเซ็ตจากหน้าโปรไฟล์"
              leading={<IconChip icon={<KeyRound className="h-4 w-4" />} />}
            />
          </div>
        </section>

        <section className="card p-5">
          <h2
            className="text-base font-semibold text-black"
            style={{ letterSpacing: "-0.01em" }}
          >
            การตรวจสอบ
          </h2>
          <div className="-mx-3 mt-2">
            <ActionRow
              href="/admin/audit"
              title="Audit Log"
              meta="บันทึกความปลอดภัย · การแก้คะแนน · การลบข้อมูล"
              leading={<IconChip icon={<ScrollText className="h-4 w-4" />} />}
            />
            <ActionRow
              href="/admin/activity"
              title="กิจกรรมในระบบ"
              meta="การบ้าน · เอกสาร · ประกาศ · การเปิดวิชา ของครูทั้งโรงเรียน"
              leading={<IconChip icon={<Activity className="h-4 w-4" />} />}
            />
          </div>
        </section>
      </div>

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
    </div>
  );
}

function IconChip({ icon }: { icon: React.ReactNode }) {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-black/[0.05] text-black/60">
      {icon}
    </span>
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
  // ADR-0028 § 8 Gallery Exception — admin /admin/dashboard class cards get
  // the full vibrant treatment because the task is visual scanning across
  // 30-40 classes. Phase 12 redesign mirrors the reference profile card:
  // centred avatar with a course-colour gradient ring, divider-separated
  // inset stats, soft hover lift.
  const c = getCourseSlotColors(id);
  const ring = `conic-gradient(from 140deg, ${c.bg}, #0a84ff, #7a7ae5, ${c.bg})`;
  return (
    <Link
      href={`/admin/classes/${id}`}
      className="card-hero group block text-center focus-visible:outline-none"
      aria-label={`เปิดข้อมูล ${name}`}
    >
      {/* Banner — soft cloud sky photo with a course-colour tint overlay
          (so each class keeps its identity) + frosted year chip. */}
      <div className="card-hero-banner relative overflow-hidden">
        <Image
          src="/brand/cloud-banner.webp"
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover"
        />
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${c.bg}55 0%, transparent 70%)`,
          }}
        />
        <span className="glass-nav absolute right-3 top-3 z-10 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium text-black/70">
          ปี {yearName}
        </span>
      </div>

      {/* Avatar — the 3D beagle mascot, centred, overlapping the banner,
          inside a course-colour gradient ring with a gentle idle float. */}
      <div className="relative z-10 -mt-11 flex justify-center">
        <span
          className="inline-flex rounded-full p-[3px] shadow-card"
          style={{
            background: ring,
            animation: "avatar-float 5s ease-in-out infinite",
          }}
        >
          <span className="relative inline-flex h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-full bg-white">
            <Image
              src="/brand/beagle-avatar.webp"
              alt="ตราสัญลักษณ์ห้องเรียน"
              width={68}
              height={68}
              className="h-full w-full scale-110 object-cover object-top"
            />
          </span>
        </span>
      </div>

      <div className="px-6 pb-6 pt-3">
        <h3
          className="text-xl font-semibold text-black"
          style={{ letterSpacing: "-0.02em" }}
        >
          {name}
        </h3>
        <p className="mt-0.5 text-xs text-black/40">{gradeLevel}</p>

        {homeroom ? (
          <p className="mt-2 text-xs text-black/60">
            ครูประจำชั้น{" "}
            <span className="font-medium text-black">
              {homeroom.firstName} {homeroom.lastName}
            </span>
          </p>
        ) : (
          <p className="mt-2 text-xs text-orange-700">ยังไม่มีครูประจำชั้น</p>
        )}

        {/* Inset stats — divider-separated, like the reference card. */}
        <dl className="panel-inset mt-4 grid grid-cols-3 divide-x divide-black/[0.06]">
          <Stat label="นักเรียน" value={enrolledStudents} />
          <Stat label="วิชา" value={courseCount} />
          <Stat label="ครู" value={teacherCount} />
        </dl>
        {enrollmentSum > 0 && (
          <p className="mt-2 text-[10px] text-black/40">
            รวม {enrollmentSum} การลงทะเบียน
          </p>
        )}

        <p className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-black/45 transition-colors group-hover:text-blue-600">
          ดูข้อมูล
          <span
            aria-hidden
            className="transition-transform group-hover:translate-x-0.5"
          >
            →
          </span>
        </p>
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-1">
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
