import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { auth } from "@/lib/auth";
import { BeagleLogo, BeagleWordmark } from "@/components/landing/beagle-logo";
import { CourseAnatomyShowcase } from "@/components/landing/course-anatomy-showcase";
import { FloatingCards } from "@/components/landing/floating-cards";
import { ShowcaseBento } from "@/components/landing/showcase-bento";
import { HowItWorks } from "@/components/landing/how-it-works";
import { PrivacyShowcase } from "@/components/landing/privacy-showcase";
import { LandingFaq } from "@/components/landing/faq";
import { AuroraShowcase } from "@/components/landing/aurora-showcase";

/**
 * Beagle Classroom — landing page (Phase 12, T1 Showcase per ADR-0029).
 *
 * Narrative arc. Sections 1–2 are the product-owner-locked focus and stay
 * fixed; everything below is the rebuilt body:
 *   1. Hero — "คิด วางแผน ติดตาม ครบในที่เดียว" + floating product
 *      mini-cards parallaxing to the pointer.
 *   2. Product illustration — the dashboard mock orbited by feature cards.
 *   3. Feature bento — what the system does, with live-styled mocks.
 *   4. How it works — the three-step setup flow.
 *   5. Privacy showcase — the L1-visibility / audit / PDPA differentiator
 *      on the page's one premium dark band.
 *   6. Aurora showpiece — a pure brand moment: cursor-pooled aurora of
 *      brand light, theme-adaptive, no information.
 *   7. FAQ — the questions schools actually ask.
 *
 * Plus glass nav, closing CTA, footer. All motion is reduced-motion-safe
 * via the shared primitives (Tilt3D, EntryStagger, AmbientBackground).
 */

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main
      className="relative flex flex-col overflow-x-hidden"
      style={{
        backgroundColor: "var(--color-bg)",
        // Graph-paper grid that backs the whole page (theme-adaptive blue
        // hairlines), plus a faint blue wash at the top edge.
        backgroundImage:
          "linear-gradient(to right, color-mix(in srgb, var(--color-blue-500) 9%, transparent) 1px, transparent 1px)," +
          "linear-gradient(to bottom, color-mix(in srgb, var(--color-blue-500) 9%, transparent) 1px, transparent 1px)," +
          "radial-gradient(120% 60% at 50% 0%, color-mix(in srgb, var(--color-blue-500) 6%, transparent) 0%, transparent 60%)",
        backgroundSize: "88px 88px, 88px 88px, 100% 100%",
        backgroundRepeat: "repeat, repeat, no-repeat",
      }}
    >
      {/* ── Glass nav ───────────────────────────────────────────── */}
      <nav className="glass-nav fixed inset-x-0 top-0 z-50 border-b border-black/[0.06]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <BeagleWordmark />
          <div className="hidden items-center gap-8 md:flex">
            <a
              href="#features"
              className="text-sm font-medium text-black/60 transition-colors hover:text-black"
            >
              ฟีเจอร์
            </a>
            <a
              href="#how"
              className="text-sm font-medium text-black/60 transition-colors hover:text-black"
            >
              วิธีใช้งาน
            </a>
            <a
              href="#faq"
              className="text-sm font-medium text-black/60 transition-colors hover:text-black"
            >
              คำถามที่พบบ่อย
            </a>
          </div>
          <Link href="/login" className="btn-primary btn-sm">
            เข้าสู่ระบบ
          </Link>
        </div>
      </nav>

      {/* ── Section 1 — Hero (ChronoTask style: floating cards on a
          light dotted canvas + soft blue glow; parallax to pointer). ── */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pt-24 pb-16">
        {/* Dotted grid texture, masked to fade at the edges */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            maskImage:
              "radial-gradient(ellipse 80% 70% at 50% 45%, #000 40%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 70% at 50% 45%, #000 40%, transparent 100%)",
          }}
        />
        {/* Soft brand glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(50% 45% at 50% 38%, rgba(10,132,255,0.10) 0%, transparent 70%)",
          }}
        />
        <FloatingCards />

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <HeroCopy />
        </div>
      </section>

      {/* ── Section 2 — Product illustration (ChronoTask-style cards) ── */}
      <CourseAnatomyShowcase />

      {/* ── Section 3 — Feature bento ───────────────────────────── */}
      <ShowcaseBento />

      {/* ── Section 4 — How it works (three-step setup) ─────────── */}
      <HowItWorks />

      {/* ── Section 5 — Privacy showcase (premium dark band) ─────── */}
      <PrivacyShowcase />

      {/* ── Section 6 — Aurora showpiece (pure brand moment) ─────── */}
      <AuroraShowcase />

      {/* ── Section 7 — FAQ ─────────────────────────────────────── */}
      <LandingFaq />

      {/* ── Closing CTA ─────────────────────────────────────────── */}
      <section className="px-6 pb-24">
        <div
          className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] px-8 py-16 text-center shadow-card md:py-20"
          style={{
            background:
              "linear-gradient(135deg, #0a84ff 0%, #0070eb 55%, #0a5fd0 100%)",
          }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(50% 60% at 80% 8%, rgba(255,255,255,0.26) 0%, transparent 55%), radial-gradient(42% 52% at 14% 96%, rgba(0,0,0,0.20) 0%, transparent 60%)",
            }}
          />
          <div className="relative z-10">
            <h2
              className="mx-auto max-w-2xl text-balance text-3xl font-semibold text-white md:text-4xl"
              style={{ letterSpacing: "-0.03em" }}
            >
              พร้อมเปลี่ยนห้องเรียนให้เป็นระบบเดียว
            </h2>
            <p className="mx-auto mt-4 max-w-md text-base text-white/80">
              เริ่มต้นใช้งาน Beagle Classroom วันนี้ — ไม่ต้องติดตั้ง
              เข้าได้ทุกอุปกรณ์
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/login"
                className="group inline-flex items-center gap-2 rounded-full bg-white py-2.5 pl-6 pr-2.5 text-base font-medium text-blue-700 transition-transform hover:scale-[0.98]"
              >
                เริ่มใช้งานฟรี
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50">
                  <ArrowRight className="h-4 w-4 text-blue-700 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
              <a
                href="#faq"
                className="rounded-full bg-white/10 px-6 py-2.5 text-base font-medium text-white ring-1 ring-inset ring-white/25 transition-colors hover:bg-white/15"
              >
                อ่านคำถามที่พบบ่อย
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="px-6 pb-12">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-4 border-t border-black/[0.08] pt-8 text-sm text-black/55">
          <div className="flex items-center gap-2">
            <BeagleLogo className="h-6 w-auto" />
            <span style={{ letterSpacing: "-0.01em" }}>
              Beagle Classroom · ปีการศึกษา 2568
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

function HeroCopy() {
  return (
    <>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/80 px-3.5 py-1.5 text-xs font-medium text-black/70 backdrop-blur-sm">
        <Sparkles className="h-3.5 w-3.5 text-blue-600" />
        ระบบจัดการห้องเรียนสำหรับโรงเรียนไทย
      </span>

      <h1
        className="mt-5 text-balance text-5xl font-semibold text-black md:text-6xl lg:text-7xl"
        style={{ letterSpacing: "-0.045em", lineHeight: 1.35 }}
      >
        คิด วางแผน ติดตาม
        <br />
        <span className="text-blue-600">ครบในที่เดียว</span>
      </h1>

      <p className="mx-auto mt-5 max-w-md text-balance text-sm leading-relaxed text-black/65 md:text-base">
        Beagle Classroom รวมเช็คชื่อ คะแนน ส่งงาน ฟีดประกาศ และผลการเรียน
        ไว้ในแอปเดียว
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/login"
          className="group inline-flex items-center gap-2 rounded-full bg-blue-500 py-2.5 pl-6 pr-2.5 text-base font-medium text-white shadow-card transition-transform hover:scale-[0.98]"
          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)" }}
        >
          เริ่มใช้งานฟรี
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
            <ArrowRight className="h-4 w-4 text-blue-600 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
        <a
          href="#features"
          className="rounded-full bg-white/80 px-6 py-2.5 text-base font-medium text-black/70 backdrop-blur-sm transition-colors hover:text-black"
        >
          ดูฟีเจอร์
        </a>
      </div>
    </>
  );
}
