import Link from "next/link";
import type { Role } from "@prisma/client";
import {
  ChevronDown,
  LogOut,
  Palette,
  Scale,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { signOut } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { Bell } from "@/components/notification/bell";
import { BeagleLogo } from "@/components/landing/beagle-logo";
import { UserAvatar } from "@/components/profile/user-avatar";
import { ThemeModeControl } from "@/components/theme/theme-mode-control";
import { moderationCenterEnabled } from "@/lib/moderation/feature-flags";

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
  maxWidth?: "max-w-4xl" | "max-w-5xl" | "max-w-6xl" | "max-w-[1480px]";
  /** Optional expanded account chip, used by the operating dashboard. */
  accountLabel?: string;
  accountSubtitle?: string;
}

export async function TopNav({
  session,
  showBell = true,
  showRoleBadge = false,
  maxWidth = "max-w-6xl",
  accountLabel,
  accountSubtitle,
}: TopNavProps) {
  const showBellResolved = showBell && Boolean(session);
  const showModeration = Boolean(session) && moderationCenterEnabled();

  // Avatar-only account entry (Phase 13) — no name in the chrome.
  const me = session
    ? await db.user.findUnique({
        where: { id: session.user.id },
        select: { profileImageId: true, themeMode: true },
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
          <BeagleLogo className="h-7 w-auto object-contain" />
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
                className={`flex h-11 cursor-pointer list-none items-center rounded-xl border border-hairline bg-surface transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-sm [&::-webkit-details-marker]:hidden ${
                  accountLabel
                    ? "gap-2 px-1.5 pr-2 sm:pr-3"
                    : "w-11 justify-center"
                }`}
                aria-label="เมนูบัญชีผู้ใช้"
              >
                <UserAvatar
                  userId={session.user.id}
                  hasImage={Boolean(me?.profileImageId)}
                  version={me?.profileImageId}
                  size={32}
                />
                {accountLabel && (
                  <>
                    <span className="hidden min-w-0 text-left sm:block">
                      <span className="block max-w-36 truncate text-xs font-semibold text-ink">
                        {accountLabel}
                      </span>
                      <span className="block max-w-36 truncate text-[10px] text-ink-mute">
                        {accountSubtitle ?? ROLE_LABEL[session.user.role]}
                      </span>
                    </span>
                    <ChevronDown
                      className="hidden h-3.5 w-3.5 text-ink-mute transition-transform group-open:rotate-180 sm:block"
                      aria-hidden="true"
                    />
                  </>
                )}
              </summary>
              <div className="absolute right-0 z-40 mt-1.5 w-72 overflow-hidden rounded-2xl border border-hairline bg-surface p-1.5 shadow-lift">
                {accountLabel && (
                  <div className="mb-1 flex items-center gap-3 rounded-xl bg-bg p-3">
                    <UserAvatar
                      userId={session.user.id}
                      hasImage={Boolean(me?.profileImageId)}
                      version={me?.profileImageId}
                      size={40}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {accountLabel}
                      </span>
                      <span className="block truncate text-xs text-ink-mute">
                        {accountSubtitle ?? ROLE_LABEL[session.user.role]}
                      </span>
                    </span>
                    <ShieldCheck
                      className="h-4 w-4 shrink-0 text-green-600"
                      aria-label="บัญชีได้รับการยืนยันแล้ว"
                    />
                  </div>
                )}
                <Link
                  href="/profile"
                  className="flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-sm text-ink transition-colors hover:bg-bg hover:no-underline"
                >
                  <UserRound
                    className="h-4 w-4 text-ink-mute"
                    aria-hidden="true"
                  />
                  โปรไฟล์
                </Link>
                {showModeration && (
                  <Link
                    href="/moderation"
                    className="flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-sm text-ink transition-colors hover:bg-bg hover:no-underline"
                  >
                    <Scale
                      className="h-4 w-4 text-ink-mute"
                      aria-hidden="true"
                    />
                    การตรวจสอบเนื้อหา
                  </Link>
                )}
                <div className="rounded-xl px-2.5 py-2">
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-mute">
                    <Palette className="h-4 w-4" aria-hidden="true" />
                    ธีม
                  </div>
                  <ThemeModeControl
                    initialMode={me?.themeMode ?? "SYSTEM"}
                    density="compact"
                  />
                </div>
                <span className="hidden" title="โหมดมืดกำลังมาเร็ว ๆ นี้">
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
