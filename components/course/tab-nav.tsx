"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type CourseTab = {
  label: string;
  href: string;
};

/**
 * Secondary navigation for the CourseOffering shell (Phase 3).
 *
 * Active-state rule — quiet pill (Calm Ledger): `bg-black/[0.05] text-black`.
 * Intentionally lighter than the primary admin sidebar (`bg-black text-white`)
 * because tabs are SECONDARY nav inside a single page — a bold solid pill
 * would compete with the course-header card for attention. See HANDOFF Q8.
 *
 * Active detection: longest matching href wins. This lets the "Overview"
 * tab (bare `/teacher/courses/[id]`) stay correctly inactive when a more
 * specific sub-route like `/teacher/courses/[id]/members` is open, while
 * still highlighting "Members" for deeper paths like
 * `/teacher/courses/[id]/members/...`.
 */
export function TabNav({ tabs }: { tabs: CourseTab[] }) {
  const pathname = usePathname();

  const activeHref = tabs
    .filter((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="flex gap-1 border-b border-black/[0.06] pb-3">
      {tabs.map((tab) => {
        const active = tab.href === activeHref;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={
              "rounded-full px-4 py-1.5 text-sm transition-colors " +
              (active
                ? "bg-black/[0.05] text-black"
                : "text-black/60 hover:bg-black/[0.03] hover:text-black")
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
