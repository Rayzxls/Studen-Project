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
    <nav className="hidden min-h-[calc(100vh-57px)] w-60 border-r border-black/[0.06] bg-white/60 p-3 backdrop-blur md:block">
      <div className="space-y-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors " +
                (active
                  ? "bg-black text-white"
                  : "text-black/60 hover:bg-black/[0.05] hover:text-black")
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
