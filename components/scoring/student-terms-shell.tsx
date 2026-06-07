import type { Role } from "@prisma/client";
import { TopNav } from "@/components/layout/top-nav";

/**
 * Minimal shell for `/student/terms/*` — top-level student nav, no
 * CourseShell tabs (those are per-CourseOffering). Phase 7 swaps the
 * bespoke "back to dashboard" bar for the shared <TopNav> so the bell
 * is reachable here too. The Studennnn logo in TopNav links to
 * /dashboard, replacing the explicit back link.
 *
 * Print styles in globals.css hide the header.
 */
export function StudentTermsShell({
  session,
  children,
}: {
  session: { user: { id: string; role: Role } };
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg">
      <TopNav session={session} maxWidth="max-w-4xl" />
      <main className="mx-auto max-w-4xl px-6 py-8 print:py-0">{children}</main>
    </div>
  );
}
