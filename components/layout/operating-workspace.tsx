import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CalendarDays,
  LayoutDashboard,
  Plus,
  Scale,
  UserRound,
  GraduationCap,
} from "lucide-react";

export type WorkspaceRole = "student" | "teacher";

function navigationFor(role: WorkspaceRole, showModeration: boolean) {
  const common = [
    { href: "/dashboard", label: "ภาพรวม", icon: LayoutDashboard },
  ];

  const roleItems =
    role === "student"
      ? [
          { href: "/student/courses", label: "ห้องเรียน", icon: BookOpen },
          {
            href: "/student/terms",
            label: "ผลการเรียน",
            icon: GraduationCap,
          },
          {
            href: "/student/timetable",
            label: "ตารางเรียน",
            icon: CalendarDays,
          },
        ]
      : [
          {
            href: "/teacher/courses",
            label: "วิชาที่สอน",
            icon: BookOpen,
          },
          {
            href: "/teacher/timetable",
            label: "ตารางสอน",
            icon: CalendarDays,
          },
          {
            href: "/teacher/courses/new",
            label: "สร้างวิชา",
            icon: Plus,
          },
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

export function WorkspaceNavigationRail({
  role,
  showModeration,
  activeHref = "/dashboard",
  desktopOnly = false,
}: {
  role: WorkspaceRole;
  showModeration: boolean;
  activeHref?: string;
  desktopOnly?: boolean;
}) {
  const items = navigationFor(role, showModeration);

  return (
    <nav
      className={`group/rail relative z-20 gap-2 overflow-x-auto rounded-2xl border border-hairline bg-surface p-2 shadow-sm xl:sticky xl:top-24 xl:h-fit xl:w-[76px] xl:flex-col xl:overflow-visible xl:transition-[width] xl:duration-300 xl:hover:w-[220px] ${
        desktopOnly ? "hidden xl:flex" : "flex"
      }`}
      aria-label="เมนูหลัก"
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active = activeHref === href;
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

export function OperatingWorkspaceGrid({
  role,
  showModeration,
  activeHref,
  main,
  aside,
  desktopNavigationOnly = false,
}: {
  role: WorkspaceRole;
  showModeration: boolean;
  activeHref?: string;
  main: ReactNode;
  aside: ReactNode;
  desktopNavigationOnly?: boolean;
}) {
  return (
    <div className="mt-6 grid gap-5 xl:grid-cols-[76px_minmax(0,1fr)_350px] xl:items-start">
      <WorkspaceNavigationRail
        role={role}
        showModeration={showModeration}
        activeHref={activeHref}
        desktopOnly={desktopNavigationOnly}
      />
      <div className="min-w-0">{main}</div>
      <aside className="space-y-4 xl:sticky xl:top-24">{aside}</aside>
    </div>
  );
}

export function WorkspacePageHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3 sm:items-center">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-xs font-semibold text-blue-700">{eyebrow}</p>
          )}
          <h1 className="mt-0.5 text-2xl font-semibold text-ink md:text-3xl">
            {title}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-mute">
            {description}
          </p>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function WorkspaceEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-hairline bg-surface p-8 text-center">
      <div>
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-700">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-base font-semibold text-ink">{title}</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-ink-mute">
          {description}
        </p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </section>
  );
}
