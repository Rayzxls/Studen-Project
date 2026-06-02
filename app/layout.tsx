import type { Metadata } from "next";
import { Anuphan } from "next/font/google";
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
  title: "Studennnn — ระบบจัดการห้องเรียน",
  description:
    "ระบบจัดการห้องเรียน · เช็คชื่อ · กรอกคะแนน · สร้างการบ้าน · ผลการเรียน",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={anuphan.variable}>
      <body className="min-h-screen bg-bg font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
