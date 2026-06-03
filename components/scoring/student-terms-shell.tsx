import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * Minimal shell for `/student/terms/*` — top-level student nav, no
 * CourseShell tabs (those are per-CourseOffering). Print styles in
 * globals.css hide the header.
 */
export function StudentTermsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-black/[0.06] bg-white/80 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-black/60 hover:text-black"
          >
            <ChevronLeft className="h-4 w-4" />
            กลับไปแดชบอร์ด
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8 print:py-0">{children}</main>
    </div>
  );
}
