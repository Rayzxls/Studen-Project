import Link from "next/link";
import { AmbientBackground } from "@/components/motion/ambient-background";

/**
 * Auth layout — Calm Ledger v2 + ADR-0029 ambient interactivity.
 * Full-page drifting gradient blobs sit behind the centered auth card
 * (the public surface is where the app gets to be most expressive).
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
            <LogoMark className="h-7 w-7 text-black" />
            <span
              className="text-xl font-medium text-black"
              style={{ letterSpacing: "-0.02em" }}
            >
              Studennnn
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
