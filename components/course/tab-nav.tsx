"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  LayoutGrid,
  ListChecks,
  Newspaper,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Icon key — a serializable string, NOT the component itself. Server
 * components build the tab list and pass it to this client component across
 * the RSC boundary; functions (Lucide icon components) cannot cross that
 * boundary, so callers pass a key and TabNav resolves it here on the client.
 */
export type CourseTabIcon =
  | "feed"
  | "lessons"
  | "quizzes"
  | "assignments"
  | "members"
  | "attendance"
  | "scores"
  | "settings"
  | "overview";

const TAB_ICONS: Record<CourseTabIcon, LucideIcon> = {
  feed: Newspaper,
  lessons: BookOpen,
  quizzes: ListChecks,
  assignments: ClipboardList,
  members: Users,
  attendance: CalendarCheck,
  scores: BarChart3,
  settings: Settings,
  overview: LayoutGrid,
};

export type CourseTab = {
  label: string;
  href: string;
  /** Icon key resolved to a Lucide component client-side (Phase 11.8). */
  icon?: CourseTabIcon;
  /** Optional count badge (e.g. งานค้าง). Rendered only when > 0. */
  badge?: number;
};

/**
 * Secondary navigation for the CourseOffering shell — Phase 11.8 redesign.
 *
 * Underline tab bar (replaces the Phase 11.7 segmented pill): the row sits
 * on a hairline baseline, the active tab carries a 2px System-Blue underline
 * plus blue label, inactive tabs are muted text on the baseline. Optional
 * leading icon + count badge per tab. Lives OUTSIDE the hero card now (the
 * shell renders it as its own bar) so the hero stays "just a hero".
 *
 * Active detection — longest matching href wins so that nested sub-routes
 * still highlight the right top-level tab.
 */
export function TabNav({ tabs }: { tabs: CourseTab[] }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  const activeHref = tabs
    .filter((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  // Centre the active tab within the scroll track (mobile: 8 tabs overflow, so
  // a right-side active tab would otherwise land off-screen). Scrolls only the
  // nav's own scrollLeft — never the page — so no vertical jump on mount.
  useEffect(() => {
    const nav = navRef.current;
    const el = activeRef.current;
    if (!nav || !el) return;
    const target = el.offsetLeft - nav.clientWidth / 2 + el.clientWidth / 2;
    nav.scrollTo({ left: Math.max(0, target), behavior: "auto" });
  }, [activeHref]);

  return (
    <nav
      ref={navRef}
      role="tablist"
      aria-label="Course sections"
      className="flex w-full gap-0.5 overflow-x-auto border-b border-black/[0.08]"
      style={{ scrollbarWidth: "none" }}
    >
      {tabs.map((tab) => {
        const active = tab.href === activeHref;
        const Icon = tab.icon ? TAB_ICONS[tab.icon] : null;
        return (
          <Link
            key={tab.href}
            ref={active ? activeRef : undefined}
            href={tab.href}
            role="tab"
            aria-selected={active}
            aria-current={active ? "page" : undefined}
            className={
              "-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3.5 text-sm font-medium hover:no-underline " +
              (active
                ? "border-blue-500 text-blue-700"
                : "border-transparent text-black/55 hover:text-black")
            }
            style={{
              transition:
                "color var(--duration-spring-standard) var(--ease-spring), border-color var(--duration-spring-standard) var(--ease-spring)",
            }}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
            {tab.label}
            {typeof tab.badge === "number" && tab.badge > 0 && (
              <span className="ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-blue-500 px-1.5 text-[11px] font-semibold leading-5 text-white">
                {tab.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
