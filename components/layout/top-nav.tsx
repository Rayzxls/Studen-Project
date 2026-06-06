import Link from "next/link";
import type { Role } from "@prisma/client";
import { signOut } from "@/lib/auth";
import { Bell } from "@/components/notification/bell";

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

function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 256 256"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M 128.005 191.173 C 128.448 156.208 156.93 128 192 128 L 192 64 L 128 64 C 128 99.346 99.346 128 64 128 L 64 192 L 128 192 Z M 192 256 L 64 256 C 28.654 256 0 227.346 0 192 L 0 64 L 64 64 L 64 0 L 192 0 C 227.346 0 256 28.654 256 64 L 256 192 L 192 192 Z" />
    </svg>
  );
}

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
          <LogoMark className="h-6 w-6 text-black" />
          <span
            className="text-base font-medium text-black"
            style={{ letterSpacing: "-0.02em" }}
          >
            Studennnn
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
