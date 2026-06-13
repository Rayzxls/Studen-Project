"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LogIn, RotateCcw } from "lucide-react";
import { BeagleWordmark } from "@/components/landing/beagle-logo";

export default function NotFoundPage() {
  const pathname = usePathname();

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-black/[0.06] bg-white p-8 text-center shadow-card">
        <div className="mx-auto mb-8 flex justify-center">
          <BeagleWordmark />
        </div>

        <p className="text-sm font-medium text-blue-700">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-black">
          ไม่พบหน้านี้ในระบบ
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-black/55">
          ระบบหาเส้นทางนี้ไม่เจอ ลองกลับหน้าแรกหรือเข้าสู่ระบบใหม่อีกครั้ง
        </p>

        <div className="mt-5 rounded-2xl bg-black/[0.04] px-4 py-3 text-left">
          <p className="text-xs font-medium text-black/45">Path ที่เปิดอยู่</p>
          <p className="mt-1 break-all font-mono text-sm text-black/70">
            {pathname || "/"}
          </p>
        </div>

        <div className="mt-7 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-black/[0.08] px-4 py-2.5 text-sm font-medium text-black/70 transition hover:bg-black/[0.04]"
          >
            <RotateCcw className="h-4 w-4" />
            โหลดใหม่
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-black/[0.08] px-4 py-2.5 text-sm font-medium text-black/70 transition hover:bg-black/[0.04] hover:no-underline"
          >
            <Home className="h-4 w-4" />
            หน้าแรก
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-600 hover:no-underline"
          >
            <LogIn className="h-4 w-4" />
            เข้าสู่ระบบ
          </Link>
        </div>
      </section>
    </main>
  );
}
