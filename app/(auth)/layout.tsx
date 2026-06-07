import Link from "next/link";
import { AmbientBackground } from "@/components/motion/ambient-background";
import { BeagleLogo } from "@/components/landing/beagle-logo";

/**
 * Auth layout — Calm Ledger v2 + ADR-0029 ambient interactivity.
 * Full-page drifting gradient blobs sit behind the centered auth card
 * (the public surface is where the app gets to be most expressive).
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-bg">
      {/* Ambient drifting blobs behind the whole auth surface (ADR-0029
          T2). intensity kept low so form text stays high-contrast. */}
      <AmbientBackground tone="blue" intensity={0.35} />

      <div className="relative z-10">
        <header className="mx-auto max-w-5xl px-6 py-6">
          <Link href="/" className="inline-flex items-center gap-2">
            <BeagleLogo className="h-8 w-8 object-contain" />
            <span
              className="text-xl font-semibold text-black"
              style={{ letterSpacing: "-0.03em" }}
            >
              Beagle <span className="text-blue-600">Classroom</span>
            </span>
          </Link>
        </header>

        <main className="mx-auto max-w-md animate-slide-up px-6 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
