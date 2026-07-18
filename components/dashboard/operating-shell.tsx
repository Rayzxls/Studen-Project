import type { ReactNode } from "react";
import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  Plus,
  Scale,
  UserRound,
  UsersRound,
} from "lucide-react";

type DashboardRole = "student" | "teacher";

function navigationFor(role: DashboardRole, showModeration: boolean) {
  const common = [
    { href: "/dashboard", label: "ภาพรวม", icon: LayoutDashboard },
  ];

  const roleItems =
    role === "student"
      ? [
          { href: "/student/courses", label: "ห้องเรียน", icon: BookOpen },
          { href: "/student/terms", label: "ผลการเรียน", icon: GraduationCap },
          {
            href: "/student/timetable",
            label: "ตารางเรียน",
            icon: CalendarDays,
          },
        ]
      : [
          { href: "/teacher/courses", label: "วิชาที่สอน", icon: BookOpen },
          { href: "/teacher/courses/new", label: "สร้างวิชา", icon: Plus },
        ];

  return [
    ...common,
    ...roleItems,
    ...(showModeration
      ? [{ href: "/moderation", label: "Moderation", icon: Scale }]
      : []),
    { href: "/profile", label: "โปรไฟล์", icon: UserRound },
  ];
}

export function DashboardNavigationRail({
  role,
  showModeration,
}: {
  role: DashboardRole;
  showModeration: boolean;
}) {
  const items = navigationFor(role, showModeration);

  return (
    <nav
      className="group/rail relative z-20 flex gap-2 overflow-x-auto rounded-2xl border border-hairline bg-surface p-2 shadow-sm xl:sticky xl:top-24 xl:h-fit xl:w-[76px] xl:flex-col xl:overflow-visible xl:transition-[width] xl:duration-300 xl:hover:w-[220px]"
      aria-label="ทางลัด Dashboard"
    >
      {items.map(({ href, label, icon: Icon }, index) => {
        const active = index === 0;
        return (
          <Link
            key={href}
            href={href}
            title={label}
            aria-current={active ? "page" : undefined}
            className={`group/item flex h-12 min-w-12 items-center gap-3 overflow-hidden rounded-xl px-3 transition-all duration-200 hover:no-underline ${
              active
                ? "bg-blue-600 text-white shadow-sm"
                : "text-ink-mute hover:bg-bg hover:text-blue-700"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="whitespace-nowrap text-sm font-semibold xl:translate-x-1 xl:opacity-0 xl:transition-all xl:duration-200 xl:group-hover/rail:translate-x-0 xl:group-hover/rail:opacity-100">
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardFocusBrief({
  role,
  title,
  detail,
  href,
}: {
  role: DashboardRole;
  title: string;
  detail: string;
  href: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-blue-500/30 bg-surface p-5 shadow-sm">
      <div className="absolute inset-x-0 top-0 h-1 bg-blue-500" />
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-700">
          {role === "student" ? (
            <GraduationCap className="h-5 w-5" aria-hidden="true" />
          ) : (
            <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
          )}
        </span>
        <span className="badge">ตอนนี้</span>
      </div>
      <p className="mt-5 text-xs font-semibold text-blue-700">
        {role === "student" ? "งานถัดไปของคุณ" : "งานแรกในคิวตรวจ"}
      </p>
      <h2 className="mt-1 line-clamp-2 text-xl font-semibold leading-8 text-ink">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-ink-mute">{detail}</p>
      <Link
        href={href}
        className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:no-underline hover:shadow-sm"
      >
        {role === "student" ? "ดูสิ่งที่ต้องทำ" : "เปิดคิวตรวจงาน"}
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}

export function DashboardOperatingGrid({
  role,
  showModeration,
  main,
  aside,
}: {
  role: DashboardRole;
  showModeration: boolean;
  main: ReactNode;
  aside: ReactNode;
}) {
  return (
    <div className="mt-6 grid gap-5 xl:grid-cols-[76px_minmax(0,1fr)_350px] xl:items-start">
      <DashboardNavigationRail role={role} showModeration={showModeration} />
      <div className="min-w-0">{main}</div>
      <aside className="space-y-4 xl:sticky xl:top-24">{aside}</aside>
    </div>
  );
}

export function DashboardSectionHeading({
  role,
  count,
  action,
}: {
  role: DashboardRole;
  count: number;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          {role === "student" ? (
            <BookOpen className="h-5 w-5 text-blue-600" aria-hidden="true" />
          ) : (
            <UsersRound className="h-5 w-5 text-blue-600" aria-hidden="true" />
          )}
          <h2 className="text-xl font-semibold text-ink">
            {role === "student" ? "ห้องเรียนของฉัน" : "ศูนย์จัดการชั้นเรียน"}
          </h2>
          <span className="text-sm text-ink-mute">{count}</span>
        </div>
        <p className="mt-1 text-sm text-ink-mute">
          {role === "student"
            ? "เปิดวิชาและไปต่อจากจุดที่ค้างไว้"
            : "เปิดห้องเรียน ตรวจงาน และติดตามสิ่งที่ต้องดูแล"}
        </p>
      </div>
      {action}
    </div>
  );
}
