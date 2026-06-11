import Link from "next/link";
import type { Role } from "@prisma/client";
import { Palette, LogOut, UserRound } from "lucide-react";
import { signOut } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { Bell } from "@/components/notification/bell";
import { BeagleLogo } from "@/components/landing/beagle-logo";
import { UserAvatar } from "@/components/profile/user-avatar";

/**
 * Shared app chrome — Phase 7 · P7-5
 *
 * Sticky top bar carrying brand + bell + sign-out across every
 * role-facing surface. Admin sets `showBell={false}` because no
 * NotificationKind targets the ADMIN role in Phase 7 (CONTEXT §
 * Notification Trigger Map).
 *
 * Pure Server Component — accepts `session` from the caller to avoid a
 * second auth() call per request. Falls back gracefully if the caller
 * does not pass a session (e.g. a future public page that still wants
 * the brand chrome).
 */

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "ผู้ดูแลระบบ",
  TEACHER: "ครู",
  STUDENT: "นักเรียน",
};

export interface TopNavProps {
  /** Pass `null` for public pages that still want the brand chrome. */
  session: {
    user: { id: string; role: Role };
  } | null;
  /** Defaults to true. Pass `false` for ADMIN routes. */
  showBell?: boolean;
  /** Render a role badge next to the logo (admin layout uses this). */
  showRoleBadge?: boolean;
  /** Max width of inner container — defaults to `max-w-6xl`. */
  maxWidth?: "max-w-4xl" | "max-w-5xl" | "max-w-6xl";
}

export async function TopNav({
  session,
  showBell = true,
  showRoleBadge = false,
  maxWidth = "max-w-6xl",
}: TopNavProps) {
  const showBellResolved = showBell && Boolean(session);

  // Avatar-only account entry (Phase 13) — no name in the chrome.
  const me = session
    ? await db.user.findUnique({
        where: { id: session.user.id },
        select: { profileImageId: true },
      })
    : null;

  return (
    <header className="glass-nav sticky top-0 z-30 border-b border-black/[0.06] print:hidden">
      <div
        className={`mx-auto flex ${maxWidth} items-center justify-between px-4 py-3 md:px-6`}
      >
        <Link
          href={session ? "/dashboard" : "/"}
          className="inline-flex items-center gap-2 hover:no-underline"
        >
          <BeagleLogo className="h-7 w-7 object-contain" />
          <span
            className="text-base font-semibold text-black"
            style={{ letterSpacing: "-0.03em" }}
          >
            Beagle <span className="text-blue-600">Classroom</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {showRoleBadge && session && (
            <span className="badge mr-1 hidden sm:inline-flex">
              {ROLE_LABEL[session.user.role]}
            </span>
          )}
          {showBellResolved && session && (
            <Bell userId={session.user.id} role={session.user.role} />
          )}
          {session && (
            <details className="group relative ml-1">
              <summary
                className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full transition-colors hover:bg-black/[0.04] [&::-webkit-details-marker]:hidden"
                aria-label="เมนูบัญชีผู้ใช้"
              >
                <UserAvatar
                  userId={session.user.id}
                  hasImage={Boolean(me?.profileImageId)}
                  size={32}
                />
              </summary>
              <div className="absolute right-0 z-40 mt-1.5 w-52 overflow-hidden rounded-2xl border border-black/[0.08] bg-white p-1.5 shadow-lift">
                <Link
                  href="/profile"
                  className="flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-sm text-black transition-colors hover:bg-black/[0.04] hover:no-underline"
                >
                  <UserRound
                    className="h-4 w-4 text-black/45"
                    aria-hidden="true"
                  />
                  โปรไฟล์
                </Link>
                <span
                  className="flex min-h-10 cursor-not-allowed items-center gap-2.5 rounded-xl px-3 text-sm text-black/35"
                  title="โหมดมืดกำลังมาเร็ว ๆ นี้"
                >
                  <Palette className="h-4 w-4" aria-hidden="true" />
                  ธีม · เร็ว ๆ นี้
                </span>
                <div className="my-1 border-t border-black/[0.06]" />
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/login" });
                  }}
                >
                  <button
                    type="submit"
                    className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm text-red-700 transition-colors hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    ออกจากระบบ
                  </button>
                </form>
              </div>
            </details>
          )}
        </div>
      </div>
    </header>
  );
}
