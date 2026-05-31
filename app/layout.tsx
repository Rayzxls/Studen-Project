import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

const plex = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-plex",
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
    <html lang="th" className={plex.variable}>
      <body className="min-h-screen font-sans text-ink">{children}</body>
    </html>
  );
}
