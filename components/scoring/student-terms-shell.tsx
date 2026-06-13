import type { Role } from "@prisma/client";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";

/**
 * Minimal shell for `/student/terms/*` — top-level student nav, no
 * CourseShell tabs (those are per-CourseOffering). Phase 7 swaps the
 * shared <TopNav> so the bell is reachable here too. We still render an
 * explicit "back to dashboard" affordance because the logo alone is too
 * subtle for normal navigation.
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
      <main className="mx-auto max-w-4xl px-6 py-8 print:py-0">
        <Link
          href="/dashboard"
          className="mb-5 inline-flex items-center gap-1 text-xs font-medium text-black/50 transition hover:text-black hover:no-underline print:hidden"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          กลับไป Dashboard
        </Link>
        {children}
      </main>
    </div>
  );
}
