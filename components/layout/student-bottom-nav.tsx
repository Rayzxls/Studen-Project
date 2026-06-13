"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

const actions = {
  student: { href: "/join", label: "เข้าร่วมชั้นเรียน" },
  teacher: { href: "/teacher/courses/new", label: "สร้างห้องเรียน" },
} as const;

type MobileActionRole = keyof typeof actions;

export function StudentBottomNav({
  role = "student",
}: {
  role?: MobileActionRole;
}) {
  const action = actions[role];

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4 md:hidden print:hidden"
      style={{
        bottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <Link
        href={action.href}
        aria-label={action.label}
        title={action.label}
        className="springy pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.3)] ring-1 ring-white/35 transition hover:bg-blue-500 hover:no-underline active:scale-95"
        style={{
          transitionDuration: "var(--duration-spring-standard)",
          transitionTimingFunction: "var(--ease-spring)",
        }}
      >
        <Plus className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
        <span className="sr-only">{action.label}</span>
      </Link>
    </div>
  );
}
