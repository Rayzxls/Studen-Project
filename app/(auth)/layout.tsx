import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mesh-bg relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="blob animate-float-slow bg-amber-300"
        style={{ width: 480, height: 480, top: -120, right: -100 }}
      />
      <div
        aria-hidden
        className="blob animate-float bg-slate-300"
        style={{ width: 360, height: 360, bottom: -120, left: -80 }}
      />

      <header className="relative z-10 mx-auto max-w-5xl px-6 py-6">
        <Link href="/" className="inline-flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white">
            S
          </div>
          <span className="font-semibold tracking-tight">Studennnn</span>
        </Link>
      </header>

      <main className="relative z-10 mx-auto max-w-md px-6 py-8 animate-fade-in">
        {children}
      </main>
    </div>
  );
}
