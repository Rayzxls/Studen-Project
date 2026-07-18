"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  KeyRound,
  MousePointerClick,
  Radio,
  Sparkles,
  UserPlus,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

/**
 * HowItWorks — Section 4 of the Beagle Classroom landing.
 *
 * A split "stage + console" layout that fills the section width:
 *   • LEFT — an orbit stage: a 3D-cartoon teacher floats at the centre on a
 *     glowing multi-layer ring, with 01/02/03 node-badges sitting on the
 *     ring and a comet travelling it. The whole orbit + subject parallax to
 *     the cursor on two depth planes.
 *   • RIGHT — an interactive console: three step rows; the active one
 *     expands to reveal its detail, metric, and a small result preview.
 * Hovering / focusing / tapping either a node-badge or a console row drives
 * the active step on both sides (two-way sync). Autoplay advances until the
 * user engages.
 *
 * The centre is a transparent 3D render; swap `src` for any transparent PNG.
 *
 * T1 showcase (ADR-0029), fully reduced-motion-safe (the global block
 * neutralises ring spin / comet / float; parallax + autoplay bail under
 * reduced-motion). Token-based throughout, so it tracks light/dark/cream.
 */

type Tone = "blue" | "green" | "amber";

type Step = {
  id: string;
  n: string;
  icon: LucideIcon;
  tone: Tone;
  title: string;
  short: string;
  body: string;
  metric: string;
  status: string;
  /** Node anchor on the orbit, as % of the square stage (120° apart). */
  pos: { x: number; y: number };
};

const TONE_HEX: Record<Tone, string> = {
  blue: "#0a84ff",
  green: "#34c759",
  amber: "#ff9500",
};

const TONE_CHIP: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-700",
  green: "bg-green-50 text-green-700",
  amber: "bg-orange-50 text-orange-700",
};

const STEPS: Step[] = [
  {
    id: "create",
    n: "01",
    icon: UserPlus,
    tone: "blue",
    title: "สร้างวิชา",
    short: "ครูเปิดห้องเรียนใหม่",
    body: "ใส่ชื่อวิชาและระดับชั้น ระบบจัดพื้นที่ของวิชาให้พร้อมในไม่กี่วินาที",
    metric: "พร้อมใน 30 วินาที",
    status: "กำลังสร้างห้อง ENG",
    pos: { x: 15, y: 30 },
  },
  {
    id: "join",
    n: "02",
    icon: KeyRound,
    tone: "green",
    title: "แชร์รหัส",
    short: "นักเรียนเข้าห้องด้วยรหัส",
    body: "ส่งรหัสห้องให้นักเรียน ทุกคนเข้าร่วมได้เอง และเห็นเฉพาะข้อมูลของตัวเอง",
    metric: "เข้าร่วมได้ไม่จำกัด",
    status: "แชร์รหัส ENG4-JFY8YW",
    pos: { x: 50, y: 90 },
  },
  {
    id: "teach",
    n: "03",
    icon: Sparkles,
    tone: "amber",
    title: "เริ่มสอน",
    short: "เช็กชื่อ ตรวจงาน ให้คะแนน",
    body: "เช็กชื่อ ตรวจงาน กรอกคะแนน และประกาศ — จัดการคาบเรียนได้จากที่เดียว",
    metric: "ครบทุกอย่างในที่เดียว",
    status: "คาบวันนี้พร้อมเริ่ม",
    pos: { x: 85, y: 30 },
  },
];

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const [engaged, setEngaged] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (engaged) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(
      () => setActive((i) => (i + 1) % STEPS.length),
      3200
    );
    return () => window.clearInterval(t);
  }, [engaged]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    function onMove(e: PointerEvent) {
      if (e.pointerType === "touch") return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = stage!.getBoundingClientRect();
        stage!.style.setProperty(
          "--px",
          ((e.clientX - r.left) / r.width - 0.5).toFixed(3)
        );
        stage!.style.setProperty(
          "--py",
          ((e.clientY - r.top) / r.height - 0.5).toFixed(3)
        );
      });
    }
    function reset() {
      stage!.style.setProperty("--px", "0");
      stage!.style.setProperty("--py", "0");
    }
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerleave", reset);
    return () => {
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", reset);
      cancelAnimationFrame(raf);
    };
  }, []);

  const activeStep = STEPS[active]!;
  const activeHex = TONE_HEX[activeStep.tone];
  const engage = (i: number) => {
    setActive(i);
    setEngaged(true);
  };

  return (
    <section
      id="how"
      className="relative scroll-mt-24 overflow-hidden px-6 py-24"
    >
      {/* Atmospheric backdrop — dotted grid + active-tone radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(color-mix(in srgb, var(--color-ink) 6%, transparent) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 38% 60%, #000 30%, transparent 78%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 38% 60%, #000 30%, transparent 78%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[34%] top-[58%] h-[40rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 transition-[background] duration-700"
        style={{
          background: `radial-gradient(circle, ${activeHex}1f 0%, transparent 60%)`,
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            <MousePointerClick className="h-3.5 w-3.5" />
            ลองเลือกแต่ละขั้นตอน
          </span>
          <h2
            className="mt-4 text-4xl font-semibold text-black md:text-5xl"
            style={{ letterSpacing: "-0.03em", lineHeight: 1.35 }}
          >
            ตั้งห้องเรียนให้พร้อม ภายในไม่กี่นาที
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-black/60">
            ครูเปิดวิชา แชร์รหัส แล้วเริ่มสอนได้ต่อเนื่องในที่เดียว — สามขั้นตอน
            ที่เชื่อมถึงกันรอบห้องเรียนดิจิทัลของคุณ
          </p>
        </div>

        <div className="grid items-center gap-10 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
          {/* ── LEFT: orbit stage ──────────────────────────────── */}
          <div
            ref={stageRef}
            className="relative mx-auto aspect-square w-full max-w-[34rem]"
            style={{ "--px": "0", "--py": "0" } as React.CSSProperties}
          >
            {/* Orbit layer — ring + comet + node-badges (parallax plane 1) */}
            <div
              className="absolute inset-0"
              style={{
                transform:
                  "translate3d(calc(var(--px) * 16px), calc(var(--py) * 16px), 0)",
                transition: "transform 350ms cubic-bezier(0.32,0.72,0,1)",
              }}
            >
              <svg
                viewBox="0 0 100 100"
                className="absolute inset-0 h-full w-full overflow-visible"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="orbitAccent" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#0a84ff" stopOpacity="0.9" />
                    <stop offset="50%" stopColor="#5eaedb" stopOpacity="0.5" />
                    <stop
                      offset="100%"
                      stopColor="#7fc1ff"
                      stopOpacity="0.85"
                    />
                  </linearGradient>
                </defs>
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={activeHex}
                  strokeWidth="1.4"
                  style={{
                    opacity: 0.4,
                    filter: `drop-shadow(0 0 2.5px ${activeHex})`,
                    transition: "stroke 500ms ease",
                  }}
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="url(#orbitAccent)"
                  strokeWidth="0.5"
                  opacity="0.8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="var(--color-hairline-strong)"
                  strokeWidth="0.4"
                  strokeDasharray="0.5 3"
                  strokeLinecap="round"
                  style={{
                    animation: "launch-ring-spin 120s linear infinite",
                    transformOrigin: "50% 50%",
                  }}
                />
              </svg>

              {/* Comet */}
              <div
                className="absolute inset-0"
                style={{ animation: "launch-ring-spin 16s linear infinite" }}
              >
                <span
                  className="absolute left-1/2 top-[10%] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    background: activeHex,
                    boxShadow: `0 0 10px 2px ${activeHex}, 0 0 22px 6px ${activeHex}55`,
                    transition: "background 500ms ease, box-shadow 500ms ease",
                  }}
                />
              </div>

              {/* Node-badges on the ring */}
              {STEPS.map((s, i) => (
                <OrbitNode
                  key={s.id}
                  step={s}
                  active={i === active}
                  onEngage={() => engage(i)}
                />
              ))}
            </div>

            {/* Centre — transparent 3D subject (parallax plane 2: tilt) */}
            <div className="absolute left-1/2 top-1/2 w-[60%] -translate-x-1/2 -translate-y-1/2">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 h-[82%] w-[82%] -translate-x-1/2 -translate-y-1/2 rounded-full transition-[background] duration-500"
                style={{
                  background: `radial-gradient(circle, ${activeHex}33 0%, transparent 68%)`,
                  filter: "blur(12px)",
                }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute bottom-[2%] left-1/2 h-5 w-[62%] -translate-x-1/2 rounded-[50%] bg-black/20"
                style={{ filter: "blur(10px)" }}
              />
              <div
                style={{
                  transform:
                    "perspective(1100px) rotateY(calc(var(--px) * 8deg)) rotateX(calc(var(--py) * -8deg))",
                  transformStyle: "preserve-3d",
                  transition: "transform 350ms cubic-bezier(0.32,0.72,0,1)",
                }}
              >
                <Image
                  src="/landing/teacher-classroom-3d.png"
                  alt="ครูกำลังสร้างห้องเรียนดิจิทัลใน Beagle Classroom พร้อมมาสคอตบีเกิล"
                  width={620}
                  height={620}
                  quality={90}
                  sizes="(max-width: 767px) 62vw, 420px"
                  className="relative h-auto w-full select-none"
                  style={{
                    animation: "launch-preview-float 7s ease-in-out infinite",
                    filter: "drop-shadow(0 26px 42px rgba(15,23,42,0.22))",
                  }}
                />
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-medium backdrop-blur"
                  style={{
                    background:
                      "color-mix(in srgb, var(--color-surface) 88%, transparent)",
                    color: "var(--color-ink)",
                    boxShadow:
                      "0 10px 28px rgba(0,0,0,0.14), inset 0 0 0 1px var(--color-hairline)",
                  }}
                >
                  <Radio className="h-3 w-3" style={{ color: activeHex }} />
                  {activeStep.status}
                </span>
              </div>
            </div>
          </div>

          {/* ── RIGHT: interactive console ─────────────────────── */}
          <div className="space-y-3">
            {STEPS.map((s, i) => (
              <ConsoleRow
                key={s.id}
                step={s}
                active={i === active}
                onEngage={() => engage(i)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────

function OrbitNode({
  step,
  active,
  onEngage,
}: {
  step: Step;
  active: boolean;
  onEngage: () => void;
}) {
  const hex = TONE_HEX[step.tone];
  return (
    <button
      type="button"
      onMouseEnter={onEngage}
      onFocus={onEngage}
      onClick={onEngage}
      aria-pressed={active}
      aria-label={`ขั้นตอน ${step.n} ${step.title}`}
      className="group absolute grid h-[3.25rem] w-[3.25rem] cursor-pointer place-items-center rounded-2xl"
      style={{
        left: `${step.pos.x}%`,
        top: `${step.pos.y}%`,
        transform: `translate(-50%, -50%) scale(${active ? 1.12 : 1})`,
        background: active
          ? hex
          : "color-mix(in srgb, var(--color-surface) 85%, transparent)",
        color: active ? "#fff" : "var(--color-ink)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        boxShadow: active
          ? `0 14px 30px -8px ${hex}cc, inset 0 1px 0 rgba(255,255,255,0.25)`
          : "0 10px 24px -12px rgba(15,23,42,0.5), inset 0 0 0 1px var(--color-hairline)",
        zIndex: active ? 30 : 20,
        transition:
          "transform 350ms cubic-bezier(0.32,0.72,0,1), background 350ms ease, box-shadow 350ms ease, color 350ms ease",
        animation: `float-card-bob ${6 + step.pos.x / 40}s ease-in-out infinite`,
      }}
    >
      <span
        className="text-lg font-semibold tabular-nums"
        style={{ letterSpacing: "-0.03em" }}
      >
        {step.n}
      </span>
    </button>
  );
}

function ConsoleRow({
  step,
  active,
  onEngage,
}: {
  step: Step;
  active: boolean;
  onEngage: () => void;
}) {
  const Icon = step.icon;
  const hex = TONE_HEX[step.tone];
  return (
    <button
      type="button"
      onMouseEnter={onEngage}
      onFocus={onEngage}
      onClick={onEngage}
      aria-pressed={active}
      className="card block w-full p-4 text-left transition-all duration-300 md:p-5"
      style={{
        boxShadow: active
          ? `0 0 0 1.5px ${hex}, var(--shadow-lift)`
          : "inset 0 0 0 1px var(--color-hairline)",
        opacity: active ? 1 : 0.82,
      }}
    >
      <div className="flex items-center gap-3.5">
        <span
          className={
            "grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition-colors " +
            (active ? "" : TONE_CHIP[step.tone])
          }
          style={active ? { background: hex, color: "#fff" } : undefined}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <strong
              className="text-base font-semibold text-black"
              style={{ letterSpacing: "-0.01em" }}
            >
              {step.title}
            </strong>
            <span
              className="ml-auto text-lg font-semibold tabular-nums"
              style={{ color: hex, letterSpacing: "-0.03em" }}
            >
              {step.n}
            </span>
          </span>
          <span className="mt-0.5 block text-xs text-black/50">
            {step.short}
          </span>
        </span>
      </div>

      {/* Expanding detail */}
      <div
        className="overflow-hidden transition-all duration-300"
        style={{
          maxHeight: active ? "16rem" : "0",
          opacity: active ? 1 : 0,
          marginTop: active ? "0.875rem" : "0",
        }}
      >
        <p className="text-sm leading-relaxed text-black/65">{step.body}</p>
        <div className="mt-3">
          <StepPreview id={step.id} />
        </div>
        <div
          className="mt-3 flex items-center gap-1.5 text-xs font-medium"
          style={{ color: hex }}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {step.metric}
          <ArrowRight className="ml-0.5 h-3.5 w-3.5" />
        </div>
      </div>
    </button>
  );
}

function StepPreview({ id }: { id: string }) {
  if (id === "create") {
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-green-50 px-3 py-2.5 text-green-700">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span className="text-xs font-medium">
          ห้อง ENG · ม.4/1 — พร้อมใช้งาน
        </span>
      </div>
    );
  }
  if (id === "join") {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-xl bg-black/[0.03] px-3 py-2.5">
          <span className="font-mono text-sm font-medium text-black">
            ENG4-JFY8YW
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-black/45">
            <Copy className="h-3.5 w-3.5" />
            คัดลอก
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-black/55">
          <UsersRound className="h-3.5 w-3.5 text-green-600" />
          มีนักเรียนกำลังเข้าร่วม
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {[
        { icon: <ClipboardCheck className="h-3.5 w-3.5" />, label: "เช็กชื่อ" },
        {
          icon: <CalendarCheck2 className="h-3.5 w-3.5" />,
          label: "ตรวจงาน 2",
        },
        { icon: <Sparkles className="h-3.5 w-3.5" />, label: "คะแนน" },
      ].map((c) => (
        <span
          key={c.label}
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-2.5 py-1.5 text-[11px] font-medium text-orange-700"
        >
          {c.icon}
          {c.label}
        </span>
      ))}
    </div>
  );
}
