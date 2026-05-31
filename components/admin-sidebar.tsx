"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Upload,
  ScrollText,
} from "lucide-react";

const items = [
  { href: "/admin/dashboard", label: "ภาพรวม", icon: LayoutDashboard },
  { href: "/admin/teachers", label: "ครู", icon: Users },
  { href: "/admin/students", label: "นักเรียน", icon: GraduationCap },
  { href: "/admin/import", label: "นำเข้า CSV", icon: Upload },
  { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav className="hidden md:block w-60 border-r border-slate-200 bg-white/60 backdrop-blur min-h-[calc(100vh-57px)] p-3">
      <div className="space-y-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors " +
                (active
                  ? "bg-ink text-white shadow-soft"
                  : "text-ink-soft hover:bg-slate-100 hover:text-ink")
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
