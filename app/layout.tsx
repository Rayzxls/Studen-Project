import type { Metadata } from "next";
import { Anuphan } from "next/font/google";
import type { ThemeMode } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { ThemeScript } from "@/components/theme/theme-script";
import "./globals.css";

// Calm Ledger theme — Anuphan (Cadson Demak, Thai+Latin)
// supersedes IBM Plex Sans Thai per ADR-0014
const anuphan = Anuphan({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-anuphan",
  display: "swap",
});

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
      className={anuphan.variable}
      data-theme-mode={themeMode.toLowerCase()}
      suppressHydrationWarning
    >
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
