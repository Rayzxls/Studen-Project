"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, BookOpen, GraduationCap, Bell } from "lucide-react";

/**
 * Student mobile bottom nav — ADR-0028 § 5 (glass-nav scope) + § 8 (student
 * mobile-first rendering). Renders only for STUDENT role + only on mobile
 * (md:hidden). Mounted in app/dashboard/page.tsx where role gating already
 * happens at the page level.
 *
 * Four destinations matching the student's mental model:
 *  - ฟีด        → /dashboard (the role-aware landing; for student it's feed)
 *  - ห้องเรียน  → /join          (course join + quick switcher)
 *  - ผลการเรียน → /student/terms (เกรดรายวิชา — CONTEXT § Learning Results)
 *  - แจ้งเตือน  → /notifications (Phase 7 bell expanded)
 *
 * Glass treatment: .glass-nav class applies the system frosted blur
 * (desktop 20px / mobile 12px) over scrolled content. iOS spring on
 * the tap-scale via .springy. Safe-area inset preserved with
 * env(safe-area-inset-bottom).
 */
const items = [
  { href: "/dashboard", label: "ฟีด", icon: LayoutGrid },
  { href: "/join", label: "ห้องเรียน", icon: BookOpen },
  { href: "/student/terms", label: "ผลการเรียน", icon: GraduationCap },
  { href: "/notifications", label: "แจ้งเตือน", icon: Bell },
] as const;

export function StudentBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="แถบนำทางหลัก"
      className="glass-nav fixed bottom-0 left-0 right-0 z-30 border-t border-black/[0.06] md:hidden print:hidden"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(`${href}/`));
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={
                  "springy flex flex-col items-center gap-1 px-2 py-2.5 text-[11px] font-medium transition-colors " +
                  (active ? "text-blue-700" : "text-black/55 hover:text-black")
                }
                style={{
                  transitionDuration: "var(--duration-spring-standard)",
                  transitionTimingFunction: "var(--ease-spring)",
                }}
              >
                <Icon
                  className="h-5 w-5"
                  strokeWidth={active ? 2.3 : 1.8}
                  aria-hidden="true"
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
