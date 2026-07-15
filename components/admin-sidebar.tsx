"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  ClipboardList,
  LayoutDashboard,
  GraduationCap,
  ScrollText,
  Activity,
  ShieldAlert,
  UserRound,
  Users,
} from "lucide-react";

const baseItems = [
  { href: "/admin/dashboard", label: "ภาพรวม", icon: LayoutDashboard },
  { href: "/admin/teachers", label: "ครู", icon: Users },
  { href: "/admin/students", label: "นักเรียน", icon: GraduationCap },
  { href: "/admin/classes", label: "ห้องเรียนทั้งหมด", icon: BookOpen },
  { href: "/admin/activity", label: "Activity Review", icon: Activity },
  { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
  { href: "/admin/setup", label: "ตั้งค่าระบบ", icon: ClipboardList },
  { href: "/profile", label: "โปรไฟล์", icon: UserRound },
];

export function AdminSidebar({
  showModeration = false,
}: {
  showModeration?: boolean;
}) {
  const pathname = usePathname();
  const items = showModeration
    ? [
        ...baseItems.slice(0, 5),
        {
          href: "/admin/moderation",
          label: "Moderation Center",
          icon: ShieldAlert,
        },
        ...baseItems.slice(5),
      ]
    : baseItems;

  return (
    <nav className="hidden min-h-[calc(100vh-57px)] w-60 border-r border-black/[0.06] bg-surface/60 p-3 md:block">
      <div className="space-y-0.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={
                "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors " +
                (active
                  ? "bg-blue-50 text-blue-700"
                  : "text-black/60 hover:bg-black/[0.03] hover:text-black")
              }
              style={{
                transitionDuration: "var(--duration-spring-standard)",
                transitionTimingFunction: "var(--ease-spring)",
              }}
            >
              {/* iOS-style active indicator — soft left bar in blue */}
              {active && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-blue-500"
                />
              )}
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
