import Link from "next/link";
import type { Role } from "@prisma/client";
import { signOut } from "@/lib/auth";
import { Bell } from "@/components/notification/bell";
import { BeagleLogo } from "@/components/landing/beagle-logo";

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
  const showSignOut = Boolean(session);
  const showBellResolved = showBell && Boolean(session);

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
          {showSignOut && (
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button type="submit" className="btn-ghost btn-sm">
                ออกจากระบบ
              </button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
