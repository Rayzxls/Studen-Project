import Image from "next/image";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { Role } from "@prisma/client";
import { TopNav } from "@/components/layout/top-nav";
import { UserAvatar } from "@/components/profile/user-avatar";
import {
  courseAcademicPeriod,
  courseMetadataParts,
} from "@/lib/course/display";
import { TabNav, type CourseTab } from "./tab-nav";

/**
 * Layout shell shared by teacher (P3-5) and student (P3-6) CourseOffering
 * tabs. The course header is a `.card-hero` surface with the classroom
 * banner; Phase 11.8 widened the shell to 1480px (matching the dashboard)
 * and moved the tab bar out of the hero so the hero stays "just a hero".
 *
 *   - <TopNav> (shared, sticky frosted)
 *   - course context bar (back link + term name)
 *   - .card-hero (banner + content zone with course title)
 *   - <TabNav> underline bar below the hero
 *   - children
 *
 * Action buttons (e.g. teacher's "QR ของห้องนี้", "regen code") live INSIDE
 * each tab page, not in the shell — keeps the shell prop-light and lets
 * tabs decide their own affordances without prop-drilling.
 */
export type CourseShellProps = {
  course: {
    id: string;
    name: string;
    subjectCode: string | null;
    learnerGroupLabel?: string | null;
    academicPeriodLabel?: string | null;
    gradeLevel: string | null;
    creditHours: number | null;
    class: { id: string; name: string } | null;
    term: { name: string } | null;
    teacher: {
      userId: string;
      firstName: string;
      lastName: string;
      user: { profileImageId: string | null };
    };
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
  const period = courseAcademicPeriod(course);
  const metadata = courseMetadataParts(course);

  return (
    <div className="min-h-screen bg-bg">
      <TopNav session={session} maxWidth="max-w-[1480px]" />

      <div className="border-b border-black/[0.06] glass-nav print:hidden">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between px-6 py-3">
          <Link href={backHref} className="btn-ghost btn-sm">
            <ChevronLeft className="h-4 w-4" />
            กลับ
          </Link>
          {period && <span className="text-xs text-ink-mute">{period}</span>}
        </div>
      </div>

      <main className="mx-auto max-w-[1480px] animate-fade-in space-y-6 px-6 py-8">
        {/* Course hero — .card-hero with banner zone + content zone. The tab
            bar renders as its own bar after this section. ADR-0028 § 4. */}
        <section className="card-hero">
          {/* Banner zone — immersive 3D classroom scene (teacher teaching),
              shared by both teacher and student course shells. */}
          <div
            className="card-hero-banner overflow-hidden"
            style={{ height: 180 }}
            aria-hidden="true"
          >
            <Image
              src="/brand/classroom-teaching.webp"
              alt=""
              fill
              priority
              sizes="(max-width: 768px) 100vw, 1024px"
              className="object-cover"
              style={{ objectPosition: "center 18%" }}
            />
            {/* Bottom white fade — blends the photo into the white content
                card that overlaps above. */}
            <div
              className="absolute inset-x-0 bottom-0 h-12"
              style={{
                background:
                  "linear-gradient(to top, var(--color-surface) 0%, transparent 100%)",
              }}
            />
            {/* Eyebrow chip floats on the banner — translucent on glass. */}
            <span className="glass-nav absolute left-6 top-4 z-10 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium text-black/70">
              {eyebrow}
            </span>
          </div>

          {/* Content zone — themed surface with content sitting up against
              the banner edge. The teacher avatar overlaps the banner
              so every course carries its owner's identity. */}
          <div className="card-hero-content relative -mt-10">
            <div className="flex items-start gap-4">
              <span
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-surface shadow-card"
                aria-hidden="true"
              >
                <UserAvatar
                  userId={course.teacher.userId}
                  hasImage={course.teacher.user.profileImageId !== null}
                  version={course.teacher.user.profileImageId}
                  size={64}
                  className="rounded-2xl ring-0"
                />
              </span>
              <div className="min-w-0 flex-1 pb-1 pt-4">
                <h1
                  className="truncate text-2xl font-semibold text-ink md:text-3xl"
                  style={{ letterSpacing: "-0.03em" }}
                >
                  {course.name}
                </h1>
                <p className="mt-1 truncate text-sm text-ink-mute">
                  {[
                    ...metadata,
                    course.subjectCode ? `รหัส ${course.subjectCode}` : null,
                    `สอนโดย ${course.teacher.firstName} ${course.teacher.lastName}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Underline tab bar — its own bar below the hero (Phase 11.8), so the
            hero stays "just a hero". Scrolls horizontally on narrow screens. */}
        <TabNav tabs={tabs} />

        <div>{children}</div>
      </main>
    </div>
  );
}
