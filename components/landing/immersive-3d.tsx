"use client";

import {
  BookOpen,
  CalendarCheck2,
  ClipboardList,
  Megaphone,
  TrendingUp,
  UsersRound,
} from "lucide-react";

/**
 * Immersive3D — Calm Ledger learning panel.
 *
 * The previous dark WebGL orbit felt detached from the product theme. This
 * version keeps the 3D feeling through layered UI cards and perspective,
 * using the same visual vocabulary as the real app: off-white page, white
 * cards, course-slot gradient, tinted KPI tiles, blue primary accents and
 * gentle iOS-style motion.
 */
export function Immersive3D() {
  return (
    <section className="px-6 py-20">
      <div className="card-hero relative mx-auto grid max-w-6xl overflow-hidden md:grid-cols-[0.9fr_1.1fr]">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(45% 55% at 15% 10%, rgba(10,132,255,0.14) 0%, transparent 62%), radial-gradient(44% 52% at 92% 18%, rgba(52,199,89,0.12) 0%, transparent 58%), radial-gradient(36% 42% at 50% 100%, rgba(255,149,0,0.10) 0%, transparent 64%)",
          }}
        />

        <div className="relative z-10 flex min-h-[30rem] flex-col justify-center px-8 py-14 md:px-12 lg:px-16">
          <span className="badge badge-info w-fit">Calm Ledger classroom</span>
          <h2
            className="mt-5 max-w-xl text-balance text-4xl font-semibold text-black md:text-5xl"
            style={{ letterSpacing: "-0.03em", lineHeight: 1.08 }}
          >
            ห้องเรียนที่ดูง่าย
            <br />
            และรู้สึกเป็นระบบ
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-black/62">
            งาน คะแนน เวลาเรียน และประกาศถูกจัดเป็นชั้นข้อมูลเดียวกัน
            ครูเห็นภาพรวมเร็ว นักเรียนเห็นสิ่งที่ต้องทำต่อโดยไม่หลงทาง
          </p>

          <div className="mt-8 grid max-w-md grid-cols-3 gap-2">
            <MiniMetric tone="blue" label="งานรอส่ง" value="3" />
            <MiniMetric tone="green" label="มาเรียน" value="92%" />
            <MiniMetric tone="orange" label="ใกล้ครบ" value="2 วัน" />
          </div>
        </div>

        <LearningStack />
      </div>
    </section>
  );
}

function LearningStack() {
  return (
    <div className="relative z-10 min-h-[34rem] overflow-hidden px-5 pb-10 pt-2 md:px-10 md:py-12">
      <div
        aria-hidden="true"
        className="absolute inset-y-8 right-4 w-[88%] rounded-[2rem] opacity-90"
        style={{
          background:
            "linear-gradient(135deg, #eef7fc 0%, #eff6ff 42%, #f2faea 100%)",
        }}
      />

      <div
        className="relative mx-auto h-[31rem] max-w-[34rem]"
        style={{ perspective: "1200px" }}
      >
        <div
          className="absolute inset-x-1 top-12 rounded-[1.75rem] bg-white p-5 shadow-card"
          style={{
            transform: "rotateX(58deg) rotateZ(-8deg)",
            transformOrigin: "center bottom",
          }}
        >
          <div className="grid grid-cols-4 gap-2">
            {["คณิต", "วิทย์", "อังกฤษ", "ศิลปะ"].map((label, index) => (
              <div
                key={label}
                className="rounded-xl bg-black/[0.025] p-2"
                style={{
                  animation: `float-card-bob ${6 + index}s ease-in-out ${index * 0.35}s infinite`,
                }}
              >
                <div
                  className="h-2 rounded-full"
                  style={{
                    background:
                      ["#0a84ff", "#34c759", "#ff9500", "#7a7ae5"][index] ??
                      "#0a84ff",
                  }}
                />
                <p className="mt-2 text-[10px] font-medium text-black/50">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div
          className="absolute left-4 right-7 top-28 rounded-[1.75rem] border border-black/[0.04] bg-white p-5 shadow-card md:left-0 md:right-12"
          style={{
            transform: "rotateY(-12deg) rotateX(6deg) translateZ(28px)",
            animation: "float-card-bob 8s ease-in-out infinite",
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
                <BookOpen className="h-3 w-3" />
                วิทยาศาสตร์ ม.3/2
              </span>
              <h3
                className="mt-3 text-xl font-semibold text-black"
                style={{ letterSpacing: "-0.02em" }}
              >
                ภาพรวมวันนี้
              </h3>
              <p className="mt-1 text-sm text-black/55">
                เช็คชื่อ งาน และคะแนนล่าสุด
              </p>
            </div>
            <div className="rounded-2xl bg-green-50 p-3 text-green-700">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <PanelMetric
              icon={<UsersRound className="h-4 w-4" />}
              value="38"
              label="นักเรียน"
            />
            <PanelMetric
              icon={<ClipboardList className="h-4 w-4" />}
              value="8/10"
              label="ส่งงาน"
            />
            <PanelMetric
              icon={<CalendarCheck2 className="h-4 w-4" />}
              value="92%"
              label="มาเรียน"
            />
          </div>

          <div className="mt-5 space-y-2">
            <ProgressLine color="#0a84ff" width="86%" />
            <ProgressLine color="#34c759" width="68%" />
            <ProgressLine color="#ff9500" width="42%" />
          </div>
        </div>

        <FloatingCard
          className="left-2 top-[19.5rem] md:left-[-1.5rem]"
          delay="0.2s"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
            <Megaphone className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-semibold text-black">ประกาศล่าสุด</p>
            <p className="mt-0.5 text-[11px] text-black/50">
              เตรียมแบบฝึกหัดก่อนคาบบ่าย
            </p>
          </div>
        </FloatingCard>

        <FloatingCard className="right-1 top-[22rem] md:right-0" delay="0.65s">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <ClipboardList className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-semibold text-black">งานที่ต้องทำ</p>
            <p className="mt-0.5 text-[11px] text-blue-700">ส่งภายในพรุ่งนี้</p>
          </div>
        </FloatingCard>

        <div
          className="absolute bottom-4 left-1/2 h-20 w-64 -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "green" | "orange";
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    orange: "bg-orange-50 text-orange-700",
  }[tone];

  return (
    <div className={`rounded-2xl px-4 py-3 ${toneClass}`}>
      <p className="text-[11px] font-medium opacity-70">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function PanelMetric({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl bg-black/[0.025] p-3">
      <div className="text-blue-700">{icon}</div>
      <p className="mt-3 text-lg font-semibold text-black">{value}</p>
      <p className="text-[10px] font-medium text-black/45">{label}</p>
    </div>
  );
}

function ProgressLine({ color, width }: { color: string; width: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-black/[0.05]">
      <div
        className="h-full rounded-full"
        style={{
          width,
          background: color,
          transition: "width var(--duration-spring-large) var(--ease-spring)",
        }}
      />
    </div>
  );
}

function FloatingCard({
  children,
  className,
  delay,
}: {
  children: React.ReactNode;
  className: string;
  delay: string;
}) {
  return (
    <div
      className={`absolute flex max-w-[15rem] items-center gap-3 rounded-2xl border border-black/[0.04] bg-white/90 px-4 py-3 shadow-card backdrop-blur-sm ${className}`}
      style={{
        transform: "translateZ(70px)",
        animation: `float-card-bob 7s ease-in-out ${delay} infinite`,
      }}
    >
      {children}
    </div>
  );
}
