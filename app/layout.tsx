import type { Metadata } from "next";
import type { ThemeMode } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { ThemeScript } from "@/components/theme/theme-script";
import "./globals.css";

// Calm Ledger theme — Anuphan (Cadson Demak, Thai+Latin)
// supersedes IBM Plex Sans Thai per ADR-0014.
// The @font-face rules and --font-anuphan live in globals.css; the files are
// served from /public/fonts, so no build fetches Google.

export const metadata: Metadata = {
  title: "Beagle Classroom — ระบบจัดการห้องเรียน",
  description:
    "ระบบจัดการห้องเรียน · เช็คชื่อ · กรอกคะแนน · สร้างการบ้าน · ผลการเรียน",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RootLayoutInner>{children}</RootLayoutInner>;
}

async function RootLayoutInner({ children }: { children: React.ReactNode }) {
  const themeMode = await getInitialThemeMode();

  return (
    <html
      lang="th"
      data-theme-mode={themeMode.toLowerCase()}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        {/* Both cuts are needed on every page — Thai for the copy, Latin for
            numerals and dates. Fonts fetch in CORS mode even same-origin, so
            the preload must be anonymous or it is downloaded twice. */}
        <link
          rel="preload"
          href="/fonts/anuphan-thai-wght-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/anuphan-latin-wght-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen bg-bg font-sans text-ink antialiased">
        <ThemeScript mode={themeMode} />
        {children}
      </body>
    </html>
  );
}

async function getInitialThemeMode(): Promise<ThemeMode> {
  const session = await auth();
  if (!session?.user?.id) return "SYSTEM";

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { themeMode: true },
  });
  return user?.themeMode ?? "SYSTEM";
}
