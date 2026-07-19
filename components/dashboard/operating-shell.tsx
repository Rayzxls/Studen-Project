import type { ReactNode } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  UsersRound,
} from "lucide-react";
export {
  OperatingWorkspaceGrid as DashboardOperatingGrid,
  WorkspaceNavigationRail as DashboardNavigationRail,
} from "@/components/layout/operating-workspace";

type DashboardRole = "student" | "teacher";

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
