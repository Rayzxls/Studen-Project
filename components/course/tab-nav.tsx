"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type CourseTab = {
  label: string;
  href: string;
};

/**
 * Secondary navigation for the CourseOffering shell — Phase 11.7 redesign.
 *
 * iOS-style **segmented control** look (ADR-0028 § 5 + § 6):
 *   - the whole bar sits in a tinted track (bg-black/[0.04])
 *   - the active tab is a white pill with --shadow-lift (sits "above" the
 *     track surface)
 *   - inactive tabs are text-on-track, no chrome
 *   - 180ms spring transition on the active slide via colour/shadow
 *
 * Active detection — longest matching href wins so that nested sub-routes
 * still highlight the right top-level tab.
 */
export function TabNav({ tabs }: { tabs: CourseTab[] }) {
  const pathname = usePathname();

  const activeHref = tabs
    .filter((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav
      role="tablist"
      aria-label="Course sections"
      className="inline-flex w-full max-w-full gap-1 overflow-x-auto rounded-2xl bg-black/[0.04] p-1"
      style={{
        scrollbarWidth: "none",
      }}
    >
      {tabs.map((tab) => {
        const active = tab.href === activeHref;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={active}
            aria-current={active ? "page" : undefined}
            className={
              "shrink-0 rounded-xl px-4 py-1.5 text-sm font-medium " +
              (active
                ? "bg-white text-black shadow-lift"
                : "text-black/60 hover:text-black")
            }
            style={{
              transition:
                "background-color var(--duration-spring-standard) var(--ease-spring), box-shadow var(--duration-spring-standard) var(--ease-spring), color var(--duration-spring-standard) var(--ease-spring)",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
