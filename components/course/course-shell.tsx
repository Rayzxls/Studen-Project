import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { Role } from "@prisma/client";
import { TopNav } from "@/components/layout/top-nav";
import { TabNav, type CourseTab } from "./tab-nav";

/**
 * Layout shell shared by teacher (P3-5) and student (P3-6) CourseOffering
 * tabs. Phase 7 stacks the shared <TopNav> on top of the existing
 * course context bar (Q15 Stack lock) — app chrome (logo/bell/sign-out)
 * sits above course chrome (back/term).
 *
 *   - <TopNav> (shared, sticky)
 *   - course context bar (back link + term name)
 *   - course title card (eyebrow badge + h1 + subtitle)
 *   - tab nav (quiet pill style — see TabNav)
 *   - children
 *
 * Action buttons (e.g. teacher's "QR ของห้องนี้", "regen code") live INSIDE
 * each tab page, not in the shell — keeps the shell prop-light and lets
 * tabs decide their own affordances without prop-drilling.
 */
export type CourseShellProps = {
  course: {
    name: string;
    subjectCode: string | null;
    gradeLevel: string;
    creditHours: number;
    class: { name: string };
    term: { name: string };
    teacher: { firstName: string; lastName: string };
  };
  /** Eyebrow badge text — e.g. "รายวิชาที่สอน" (teacher) or "ห้องเรียน" (student) */
  eyebrow: string;
  /** Back-link target — e.g. "/teacher/courses" or "/student/courses" */
  backHref: string;
  tabs: CourseTab[];
  /** Auth session — drives the bell. Phase 7 adds this; callers must pass it. */
  session: { user: { id: string; role: Role } };
  children: React.ReactNode;
};

export function CourseShell({
  course,
  eyebrow,
  backHref,
  tabs,
  session,
  children,
}: CourseShellProps) {
  return (
    <div className="min-h-screen bg-bg">
      <TopNav session={session} maxWidth="max-w-5xl" />

      <div className="border-b border-black/[0.06] bg-white/60 print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link href={backHref} className="btn-ghost btn-sm">
            <ChevronLeft className="h-4 w-4" />
            กลับ
          </Link>
          <span className="text-xs text-black/60">{course.term.name}</span>
        </div>
      </div>

      <main className="mx-auto max-w-5xl animate-fade-in space-y-6 px-6 py-10">
        <div>
          <div className="badge mb-2">{eyebrow}</div>
          <h1
            className="text-3xl font-medium text-black md:text-4xl"
            style={{ letterSpacing: "-0.03em" }}
          >
            {course.name}
          </h1>
          <p className="mt-1 text-sm text-black/60">
            ห้อง {course.class.name} · {course.gradeLevel} ·{" "}
            {course.creditHours} หน่วยกิต
            {course.subjectCode ? ` · รหัส ${course.subjectCode}` : ""} · สอนโดย{" "}
            {course.teacher.firstName} {course.teacher.lastName}
          </p>
        </div>

        <TabNav tabs={tabs} />

        <div>{children}</div>
      </main>
    </div>
  );
}
