import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { auth } from "@/lib/auth";

/**
 * Landing — Calm Ledger theme (ADR-0014)
 *
 * Halo recipe adapted to Studennnn:
 *   • h-screen wrapper (Navbar absolute + Hero card)
 *   • Info Section "ทำความรู้จัก Studennnn" with 3-card row (1 light + 2 aubergine)
 *   • Use Cases section with featured aubergine card
 *
 * Omitted from the Halo recipe (per user direction):
 *   • Brand Marquee (no Studennnn-equivalent crypto-brand list)
 *   • Backed By section (single-tenant per school, no investor logos)
 *
 * Media placeholders — see image-prompts.md (this commit) for the 3 hero/card
 * background image briefs ready to feed into Midjourney/SDXL/Flux when the
 * user generates them.
 */

function LogoMark({ className }: { className?: string }) {
  // Two interlocking rounded squares — neutral geometric mark, no trademark.
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

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="flex flex-col bg-bg">
      {/* ──────────────────────────────────────────────────────────
          HERO WRAPPER — h-screen (Navbar absolute + Hero card)
          ────────────────────────────────────────────────────────── */}
      <div className="relative flex h-screen flex-col overflow-hidden">
        {/* Navbar */}
        <nav className="absolute inset-x-0 top-0 z-20 px-6 py-5">
          <div className="mx-auto flex max-w-[88rem] items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <LogoMark className="h-7 w-7 text-black" />
              <span
                className="text-2xl font-medium text-black"
                style={{ letterSpacing: "-0.02em" }}
              >
                Studennnn
              </span>
            </Link>
            <div className="hidden items-center gap-8 md:flex">
              <a
                href="#info"
                className="text-base font-medium text-black/60 transition-colors hover:text-black"
              >
                เกี่ยวกับ
              </a>
              <a
                href="#roles"
                className="text-base font-medium text-black/60 transition-colors hover:text-black"
              >
                บทบาท
              </a>
              <Link
                href="/privacy"
                className="text-base font-medium text-black/60 transition-colors hover:text-black"
              >
                ความเป็นส่วนตัว
              </Link>
            </div>
            <Link
              href="/login"
              className="rounded-full bg-black px-7 py-2.5 text-base font-medium text-white transition-colors duration-200 hover:bg-[#1f1f1f]"
            >
              เข้าสู่ระบบ
            </Link>
          </div>
        </nav>

        {/* Hero card */}
        <div className="mx-auto flex w-full max-w-[88rem] flex-1 items-end px-6 pb-6 pt-20">
          <div
            className="relative w-full overflow-hidden rounded-3xl bg-white"
            style={{ height: "calc(100vh - 96px)" }}
          >
            {/* Hero background image — cream wall + aubergine volume composition */}
            <Image
              src="/landing/hero-bg.webp"
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />

            {/* Content overlay */}
            <div className="relative z-10 flex h-full flex-col items-start justify-start p-8 pt-32 md:p-12 md:pt-36">
              <h1
                className="mb-5 max-w-3xl text-balance text-5xl font-medium text-black md:text-6xl lg:text-7xl"
                style={{ letterSpacing: "-0.04em", lineHeight: 1.05 }}
              >
                ห้องเรียนของคุณ
                <br />
                ครบทุกเทอม
              </h1>
              <p className="mb-10 max-w-md text-base leading-relaxed text-black/70 md:text-lg">
                Studennnn คือระบบจัดการห้องเรียนสำหรับโรงเรียนไทย ที่รวมเช็คชื่อ
                คะแนน ส่งงาน และผลการเรียน ไว้ในแอปเดียว
              </p>
              <Link
                href="/login"
                className="group inline-flex items-center gap-3 rounded-full bg-black py-2 pl-8 pr-2 text-base font-medium text-white transition-colors duration-200 hover:bg-[#1f1f1f] md:text-lg"
              >
                เริ่มใช้งาน
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white transition-transform duration-200 ease-out group-hover:translate-x-0.5">
                  <ArrowRight className="h-5 w-5 text-black" />
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          INFO SECTION — "ทำความรู้จัก Studennnn"
          ────────────────────────────────────────────────────────── */}
      <section id="info" className="bg-bg px-6 py-24">
        <div className="mx-auto max-w-[88rem]">
          <div className="mb-16 grid grid-cols-1 items-start gap-12 md:grid-cols-2">
            <div>
              <h2
                className="mb-8 text-balance text-4xl font-medium leading-tight text-black md:text-5xl"
                style={{ letterSpacing: "-0.03em" }}
              >
                ทำความรู้จัก
                <br />
                Studennnn
              </h2>
              <Link
                href="/login"
                className="group inline-flex items-center gap-3 rounded-full bg-black py-2 pl-8 pr-2 text-base font-medium text-white transition-colors duration-200 hover:bg-[#1f1f1f]"
              >
                เริ่มใช้
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white transition-transform duration-200 ease-out group-hover:translate-x-0.5">
                  <ArrowRight className="h-5 w-5 text-black" />
                </span>
              </Link>
            </div>
            <div>
              <p className="text-2xl leading-relaxed text-black/70 md:text-3xl">
                Studennnn รวม Google Classroom + ระบบเกรดของโรงเรียนให้เป็น
                workspace เดียว ครูตั้งชื่อวิชาเอง แชร์รหัสห้อง ออกเกรดด้วย Term
                GPA ที่ระบบคำนวณให้
              </p>
            </div>
          </div>

          {/* 3-card row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1 — featured with image, spans 2 cols on lg */}
            <article className="relative flex min-h-80 flex-col justify-between overflow-hidden rounded-2xl p-7 lg:col-span-2">
              <Image
                src="/landing/info-card-1.webp"
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
              {/* foreground sits over the bright left half of the image */}
              <h3
                className="relative z-10 text-2xl font-medium leading-snug text-black"
                style={{ letterSpacing: "-0.02em" }}
              >
                เกรดอัปเดต
                <br />
                ทันทีที่ครูบันทึก
              </h3>
              <p className="relative z-10 max-w-xs text-base text-black/70">
                Weighted total และ Term GPA คำนวณให้อัตโนมัติทุกครั้งที่ครู
                publish คะแนนใหม่ นักเรียนเห็นทันที
              </p>
            </article>

            {/* Card 2 — aubergine */}
            <article
              className="flex min-h-80 flex-col justify-between rounded-2xl p-7 text-white"
              style={{ background: "#2b2644" }}
            >
              <h3
                className="text-2xl font-medium text-white"
                style={{ letterSpacing: "-0.02em", lineHeight: 1.2 }}
              >
                เข้าได้ทุกที่
                <br />
                ทุกเวลา
              </h3>
              <p className="text-base text-white/60">
                คอม มือถือ แท็บเล็ต — เข้าสู่ระบบเดียวกัน ไม่มีล็อกเครื่อง
                ไม่ต้องติดตั้งแอป
              </p>
            </article>

            {/* Card 3 — aubergine */}
            <article
              className="flex min-h-80 flex-col justify-between rounded-2xl p-7 text-white"
              style={{ background: "#2b2644" }}
            >
              <h3
                className="text-2xl font-medium text-white"
                style={{ letterSpacing: "-0.02em", lineHeight: 1.2 }}
              >
                คำนวณเกรด
                <br />
                อัตโนมัติ
              </h3>
              <p className="text-base text-white/60">
                Weighted total + grade table ตามมาตรฐานโรงเรียน ครูไม่ต้องส่งออก
                Excel
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────
          USE CASES — "บทบาทผู้ใช้"
          ────────────────────────────────────────────────────────── */}
      <section id="roles" className="bg-bg px-6 py-24">
        <div className="mx-auto max-w-[88rem]">
          <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-2">
            {/* Left col — heading + body */}
            <div className="md:pr-12 md:pt-2">
              <p className="mb-2 text-sm text-black/60">
                Studennnn ในการใช้งาน
              </p>
              <h2
                className="mb-6 text-5xl font-medium leading-none text-black md:text-6xl"
                style={{ letterSpacing: "-0.04em" }}
              >
                บทบาทผู้ใช้
              </h2>
              <p className="max-w-sm text-base leading-relaxed text-black/60">
                Studennnn รองรับ 3 บทบาท: ครู นักเรียน ผู้ดูแล
                แต่ละบทบาทมีหน้าจอและ workflow ที่ออกแบบเฉพาะ ไม่ใช่ template
                เดียวกันสามใบ
              </p>
            </div>

            {/* Right col — featured aubergine card with photo */}
            <div className="relative min-h-[720px] overflow-hidden rounded-3xl bg-[#2b2644]">
              <Image
                src="/landing/use-cases-teacher.webp"
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
              {/* dark gradient bottom-left → ensures text contrast across image variation */}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to right, rgba(15,10,30,0.55) 0%, rgba(15,10,30,0.25) 45%, rgba(15,10,30,0) 70%)",
                }}
              />
              <div className="relative z-10 p-10 text-white md:p-12">
                <p className="mb-3 text-sm text-white/70">บทบาทเด่น</p>
                <h3
                  className="mb-5 text-4xl font-medium leading-tight text-white md:text-5xl"
                  style={{ letterSpacing: "-0.03em" }}
                >
                  ครูเจ้าของห้อง
                </h3>
                <p className="mb-8 max-w-md text-base leading-relaxed text-white/80">
                  ครูสร้างวิชา ตั้งชื่อ + หน่วยกิตเอง แชร์รหัสห้องให้นักเรียน
                  เช็คชื่อ ตรวจงาน กรอกคะแนน ออกเกรด — ทุกอย่างใน workspace
                  เดียวในเทอมเดียวกัน
                </p>
                <Link
                  href="/login"
                  className="group inline-flex items-center gap-3 text-base font-medium text-white"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 backdrop-blur transition-colors duration-200 group-hover:bg-white">
                    <ArrowRight className="h-4 w-4 text-black" />
                  </span>
                  ดูเพิ่ม
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────
          FOOTER STRIP — minimal credibility line
          ────────────────────────────────────────────────────────── */}
      <footer className="bg-bg px-6 py-12">
        <div className="mx-auto flex max-w-[88rem] flex-wrap items-center justify-between gap-y-4 border-t border-black/[0.08] pt-8 text-sm text-black/60">
          <div className="flex items-center gap-2">
            <LogoMark className="h-5 w-5 text-black/60" />
            <span style={{ letterSpacing: "-0.01em" }}>
              Studennnn · ปีการศึกษา 2568
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span>PDPA Compliance</span>
            <Link
              href="/privacy"
              className="transition-colors hover:text-black"
            >
              นโยบายความเป็นส่วนตัว
            </Link>
            <Link href="/login" className="transition-colors hover:text-black">
              เข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
