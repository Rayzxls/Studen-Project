import Image from "next/image";
import { BookOpen, Users, ClipboardCheck, Clock3 } from "lucide-react";
import {
  getTeacherStats,
  getTeacherTodaySchedule,
  type TodayClass,
} from "@/lib/dashboard/queries";
import { AnimatedStat } from "@/components/dashboard/animated-stat";
import { CourseColorChip } from "@/components/course/course-color-chip";
import { UserAvatar } from "@/components/profile/user-avatar";

/**
 * TeacherHero — Phase 11D · ADR-0028 § 8 (teacher = medium vibrancy).
 *
 * White-surface .card-hero with a soft blue-tinted banner strip up top,
 * greeting + today summary on the content zone, four KPI tiles in a
 * .panel-inset grid, and a "ตารางวันนี้" schedule list. The teacher view
 * keeps chrome calm — no saturated blue card-accent — because the page
 * is a workspace, not a consumption surface.
 *
 * Pure Server Component; reads the dashboard KPIs + today's schedule via
 * the shared lib/dashboard module so an admin opening the same page sees
 * the same numbers.
 */
export async function TeacherHero({
  teacherUserId,
  name,
  hasAvatar = false,
}: {
  teacherUserId: string;
  name: string;
  hasAvatar?: boolean;
}) {
  const [stats, today] = await Promise.all([
    getTeacherStats(teacherUserId),
    getTeacherTodaySchedule(teacherUserId),
  ]);

  return (
    <section className="card-hero">
      {/* Banner zone — soft blue wash with ambient drifting blobs
          (ADR-0029 T2). intensity kept low so it reads as calm
          workspace, not a saturated student hero. */}
      <div className="card-hero-banner relative overflow-hidden">
        <Image
          src="/brand/classroom-bg.webp"
          alt=""
          fill
          priority
          sizes="(max-width: 768px) 100vw, 1024px"
          className="object-cover opacity-80"
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.3) 70%, transparent 100%)",
          }}
        />
      </div>

      <div className="card-hero-content -mt-10">
        {/* Greeting card sits over the banner edge — the iOS profile-card
            avatar-overlap pattern, but for type rather than an avatar. */}
        <div className="relative z-10 inline-flex items-baseline gap-2 rounded-2xl bg-white px-4 py-2 shadow-card">
          <span className="text-xs font-medium text-blue-700">
            พื้นที่ทำงานของคุณ
          </span>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <UserAvatar userId={teacherUserId} hasImage={hasAvatar} size={44} />
          <h1
            className="text-3xl font-semibold text-black md:text-4xl"
            style={{ letterSpacing: "-0.03em" }}
          >
            สวัสดี, {name}
          </h1>
        </div>
        <p className="mt-1 text-sm text-black/60">
          {today.length === 0
            ? "วันนี้ไม่มีคาบเรียนตามตาราง"
            : `วันนี้คุณมี ${today.length} คาบเรียน · เริ่ม ${today[0]!.startTime}`}
        </p>

        {/* KPI strip — .panel-inset subordinate panel inside the hero card. */}
        <dl className="panel-inset mt-6 grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-4">
          <Kpi
            icon={<BookOpen className="h-4 w-4" />}
            label="วิชาที่สอน"
            value={stats.courseCount}
          />
          <Kpi
            icon={<Users className="h-4 w-4" />}
            label="นักเรียนทั้งหมด"
            value={stats.studentCount}
          />
          <Kpi
            icon={<ClipboardCheck className="h-4 w-4" />}
            label="งานรอตรวจ"
            value={stats.ungradedSubmissions}
            highlight={stats.ungradedSubmissions > 0 ? "orange" : null}
          />
          <Kpi
            icon={<Clock3 className="h-4 w-4" />}
            label="คาบ/สัปดาห์"
            value={Math.round(stats.weeklyTeachingMinutes / 60)}
            suffix="ชม."
          />
        </dl>

        {/* Today's schedule list — only render when there's something to show. */}
        {today.length > 0 && (
          <div className="mt-6">
            <h2
              className="text-sm font-medium text-black/80"
              style={{ letterSpacing: "-0.01em" }}
            >
              ตารางวันนี้
            </h2>
            <ul className="mt-2 space-y-1.5">
              {today.map((s) => (
                <ScheduleRow key={`${s.courseId}-${s.startTime}`} slot={s} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function Kpi({
  icon,
  label,
  value,
  suffix,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  highlight?: "orange" | "green" | "red" | null;
}) {
  const tone =
    highlight === "orange"
      ? "text-orange-700"
      : highlight === "green"
        ? "text-green-700"
        : highlight === "red"
          ? "text-red-700"
          : "text-black";
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-black/55">
        <span aria-hidden>{icon}</span>
        {label}
      </div>
      <div
        className={"mt-1.5 text-2xl font-semibold " + tone}
        style={{ letterSpacing: "-0.02em" }}
      >
        <AnimatedStat value={value} suffix={suffix} />
      </div>
    </div>
  );
}

function ScheduleRow({ slot }: { slot: TodayClass }) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-black/[0.02] px-3 py-2.5 transition-colors hover:bg-black/[0.04]">
      <CourseColorChip classId={slot.classId} variant="marker" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-black">
          {slot.courseName}
        </p>
        <p className="mt-0.5 truncate text-xs text-black/55">
          ห้อง {slot.className}
          {slot.location ? ` · ${slot.location}` : ""}
        </p>
      </div>
      <span className="shrink-0 font-mono text-xs text-black/70">
        {slot.startTime}–{slot.endTime}
      </span>
    </li>
  );
}
