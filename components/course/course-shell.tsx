import Image from "next/image";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { Role } from "@prisma/client";
import { TopNav } from "@/components/layout/top-nav";
import { UserAvatar } from "@/components/profile/user-avatar";
import { TabNav, type CourseTab } from "./tab-nav";

/**
 * Layout shell shared by teacher (P3-5) and student (P3-6) CourseOffering
 * tabs. Phase 11.7 redesign: course header becomes a `.card-hero` surface
 * with the course-slot gradient mesh banner (same hash as /admin/dashboard
 * class cards + /dashboard course lists), giving each course a stable
 * visual identity carried through every tab.
 *
 *   - <TopNav> (shared, sticky frosted)
 *   - course context bar (back link + term name)
 *   - .card-hero (course slot banner + content zone with course title)
 *   - <TabNav> as iOS-segmented control on the card edge
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
    class: { id: string; name: string };
    term: { name: string };
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
  return (
    <div className="min-h-screen bg-bg">
      <TopNav session={session} maxWidth="max-w-5xl" />

      <div className="border-b border-black/[0.06] glass-nav print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link href={backHref} className="btn-ghost btn-sm">
            <ChevronLeft className="h-4 w-4" />
            กลับ
          </Link>
          <span className="text-xs text-black/60">{course.term.name}</span>
        </div>
      </div>

      <main className="mx-auto max-w-5xl animate-fade-in space-y-6 px-6 py-8">
        {/* Course hero — .card-hero with banner zone + content zone +
            segmented tab nav sitting on the card edge. ADR-0028 § 4 +
            § 5. */}
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
          <div className="card-hero-content relative -mt-10 pb-0">
            <div className="flex items-start gap-4">
              <span
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-surface shadow-card"
                aria-hidden="true"
              >
                <UserAvatar
                  userId={course.teacher.userId}
                  hasImage={course.teacher.user.profileImageId !== null}
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
                  ห้อง {course.class.name} · {course.gradeLevel} ·{" "}
                  {course.creditHours} หน่วยกิต
                  {course.subjectCode ? ` · รหัส ${course.subjectCode}` : ""} ·
                  สอนโดย {course.teacher.firstName} {course.teacher.lastName}
                </p>
              </div>
            </div>

            {/* iOS-segmented tab nav along the bottom edge of the card. */}
            <div className="mt-5 -mx-6 px-6 pt-2 pb-0">
              <TabNav tabs={tabs} />
            </div>
          </div>
        </section>

        <div>{children}</div>
      </main>
    </div>
  );
}
