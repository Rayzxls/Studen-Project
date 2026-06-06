import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, GraduationCap, ShieldCheck, Sparkles } from "lucide-react";
import { auth } from "@/lib/auth";
import { BeagleLogo, BeagleWordmark } from "@/components/landing/beagle-logo";
import { FloatingCards } from "@/components/landing/floating-cards";
import { ShowcaseBento } from "@/components/landing/showcase-bento";

/**
 * Beagle Classroom — landing page (Phase 12).
 *
 * Two product-owner-specified focus sections:
 *   1. Hero — "คิด วางแผน ติดตาม ครบในที่เดียว" with an R3F 3D backdrop
 *      (ADR-0029 T1) + floating product mini-cards parallaxing to the
 *      pointer (ChronoTask reference, in our brand).
 *   2. Showcase bento — what the system does, with live-styled mocks.
 *
 * Plus glass nav, closing CTA, footer. Real interactivity throughout;
 * all motion is reduced-motion-safe via the primitives.
 */

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="flex flex-col overflow-x-hidden bg-bg">
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
              href="#roles"
              className="text-sm font-medium text-black/60 transition-colors hover:text-black"
            >
              บทบาท
            </a>
            <Link
              href="/privacy"
              className="text-sm font-medium text-black/60 transition-colors hover:text-black"
            >
              ความเป็นส่วนตัว
            </Link>
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
      <section id="overview" className="relative overflow-hidden px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            <Sparkles className="h-3.5 w-3.5" />
            ดีไซน์ที่คิดมาเพื่อห้องเรียน
          </span>
          <h2
            className="mt-4 text-4xl font-semibold text-black md:text-5xl"
            style={{ letterSpacing: "-0.03em", lineHeight: 1.1 }}
          >
            ทุกข้อมูลของห้องเรียน
            <br />
            อยู่ตรงหน้าในมุมเดียว
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-black/60">
            สรุปการสอบ ตารางเรียนวันนี้ อัตราการเข้าเรียน การแจ้งเตือนงาน
            และการเชื่อมต่อแอป — เห็นครบในหน้าจอเดียว
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-6xl">
          <Image
            src="/landing/hero-cards.webp"
            alt="ตัวอย่างการ์ดในระบบ Beagle Classroom — สรุปการสอบ ตารางเรียน อัตรามาเรียน และการแจ้งเตือน"
            width={1672}
            height={941}
            className="h-auto w-full select-none"
          />
        </div>
      </section>

      {/* ── Section 3 — Feature bento ───────────────────────────── */}
      <ShowcaseBento />

      {/* ── Roles strip ─────────────────────────────────────────── */}
      <section id="roles" className="px-6 py-20">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
          <RoleCard
            icon={<GraduationCap className="h-5 w-5" />}
            tone="blue"
            title="ครูเจ้าของห้อง"
            body="สร้างวิชา แชร์รหัสห้อง เช็คชื่อ ตรวจงาน กรอกคะแนน ออกเกรด — workspace เดียวต่อเทอม"
          />
          <RoleCard
            icon={<Sparkles className="h-5 w-5" />}
            tone="green"
            title="นักเรียน"
            body="ดูคะแนนตัวเอง อัตรามาเรียน เดดไลน์ และส่งงานจากมือถือ เห็นเฉพาะของตัวเอง"
          />
          <RoleCard
            icon={<ShieldCheck className="h-5 w-5" />}
            tone="violet"
            title="ผู้ดูแล"
            body="ภาพรวมทั้งโรงเรียน ตรวจ audit log นำเข้า CSV รีเซ็ตรหัสผ่าน — ไม่ยุ่งกับข้อมูลแทนใคร"
          />
        </div>
      </section>

      {/* ── Closing CTA ─────────────────────────────────────────── */}
      <section className="px-6 pb-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-blue-500 px-8 py-16 text-center shadow-card md:py-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(50% 60% at 80% 10%, rgba(255,255,255,0.22) 0%, transparent 55%), radial-gradient(40% 50% at 15% 90%, rgba(0,0,0,0.18) 0%, transparent 60%)",
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
            <Link
              href="/login"
              className="group mt-8 inline-flex items-center gap-2 rounded-full bg-white py-2.5 pl-6 pr-2.5 text-base font-medium text-blue-700 transition-transform hover:scale-[0.98]"
            >
              เข้าสู่ระบบ
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50">
                <ArrowRight className="h-4 w-4 text-blue-700 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="px-6 pb-12">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-4 border-t border-black/[0.08] pt-8 text-sm text-black/55">
          <div className="flex items-center gap-2">
            <BeagleLogo className="h-6 w-6" />
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
        style={{ letterSpacing: "-0.045em", lineHeight: 1.02 }}
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

function RoleCard({
  icon,
  title,
  body,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone: "blue" | "green" | "violet";
}) {
  const chip = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    violet: "bg-[#eff0fe] text-[#3730a3]",
  }[tone];
  return (
    <div className="card p-7 transition-shadow hover:shadow-lift">
      <span
        className={
          "inline-flex h-11 w-11 items-center justify-center rounded-2xl " +
          chip
        }
      >
        {icon}
      </span>
      <h3
        className="mt-4 text-lg font-semibold text-black"
        style={{ letterSpacing: "-0.02em" }}
      >
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-black/60">{body}</p>
    </div>
  );
}
