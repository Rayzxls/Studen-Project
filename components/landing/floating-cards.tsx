"use client";

import { useEffect, useRef } from "react";
import {
  CalendarCheck2,
  Check,
  ClipboardList,
  Megaphone,
  TrendingUp,
} from "lucide-react";

/**
 * FloatingCards — the ChronoTask-style hero decoration for Beagle
 * Classroom (ADR-0029 T1). Real product mini-cards (sticky note, score,
 * attendance, reminder, feed, submissions, a checkbox task, integrations)
 * float around the headline at different depths and parallax-shift with
 * the pointer, plus a gentle idle bob.
 *
 * Pointer parallax writes CSS vars on the root from a single rAF-throttled
 * mousemove; reduced-motion users get the static composed layout (the
 * handler simply never shifts, and the bob is neutralised by the global
 * reduced-motion block).
 */
export function FloatingCards() {
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduce) return;

    let raf = 0;
    function onMove(e: MouseEvent) {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el!.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el!.style.setProperty("--px", x.toFixed(3));
        el!.style.setProperty("--py", y.toFixed(3));
      });
    }
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={root}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden md:block"
      style={{ "--px": "0", "--py": "0" } as React.CSSProperties}
    >
      {/* Sticky note — top-left, deep (ChronoTask signature) */}
      <FloatNote depth={24} className="left-[3%] top-[8%]">
        จดโน้ตการบ้าน
        <br />
        ไม่ให้พลาดเดดไลน์
        <br />
        ของทุกวิชา
      </FloatNote>

      {/* Score card — left, mid */}
      <FloatCard depth={32} className="left-[6%] top-[40%]">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-50 text-green-700">
            <TrendingUp className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] text-black/45">คะแนนรวม</p>
            <p
              className="text-lg font-semibold text-black"
              style={{ letterSpacing: "-0.02em" }}
            >
              92<span className="text-xs text-black/40">%</span>
            </p>
          </div>
        </div>
        <div className="mt-3 h-1.5 w-32 overflow-hidden rounded-full bg-black/[0.06]">
          <div className="h-full w-[92%] rounded-full bg-green-500" />
        </div>
      </FloatCard>

      {/* Attendance ring — top-right, mid */}
      <FloatCard depth={44} className="right-[5%] top-[12%]">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12">
            <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="rgba(0,0,0,0.07)"
                strokeWidth="4"
              />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="#0a84ff"
                strokeWidth="4"
                strokeDasharray="94.2"
                strokeDashoffset="9.4"
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-black">
              90%
            </span>
          </div>
          <div>
            <p className="text-[10px] text-black/45">มาเรียน</p>
            <p className="text-sm font-medium text-black">เทอมนี้</p>
          </div>
        </div>
      </FloatCard>

      {/* Reminder card — right, shallow */}
      <FloatCard depth={60} className="right-[8%] top-[42%]">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
            <CalendarCheck2 className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] text-black/45">ใกล้กำหนดส่ง</p>
            <p className="text-sm font-medium text-black">แบบฝึกหัดบทที่ 3</p>
            <p className="text-[10px] text-orange-700">พรุ่งนี้ 08:30</p>
          </div>
        </div>
      </FloatCard>

      {/* Feed post — bottom-left, mid */}
      <FloatCard depth={50} className="bottom-[12%] left-[6%]">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-700">
            สใ
          </span>
          <div>
            <p className="text-[11px] font-medium text-black">ครูสมชาย ใจดี</p>
            <p className="text-[9px] text-black/40">2 นาทีก่อน</p>
          </div>
          <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[9px] font-medium text-orange-700">
            <Megaphone className="h-2.5 w-2.5" />
            ประกาศ
          </span>
        </div>
        <p className="mt-2 max-w-[12rem] text-[11px] leading-relaxed text-black/60">
          พรุ่งนี้มีสอบเก็บคะแนนบทที่ 3 เตรียมตัวมาให้พร้อมนะครับ
        </p>
      </FloatCard>

      {/* Assignment chip — bottom-center, deep */}
      <FloatCard depth={34} className="bottom-[20%] right-[26%]">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <ClipboardList className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] text-black/45">ส่งงานแล้ว</p>
            <p className="text-sm font-semibold text-green-700">8 / 10</p>
          </div>
        </div>
      </FloatCard>

      {/* Checkbox task — top-center-left, shallow (ChronoTask signature) */}
      <FloatCard depth={56} className="left-[24%] top-[10%]">
        <div className="flex items-center gap-2.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-500 text-white">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
          <span className="text-xs font-medium text-black/70 line-through decoration-black/30">
            เช็คชื่อคาบเช้า
          </span>
        </div>
      </FloatCard>

      {/* Integrations — bottom-right, mid */}
      <FloatCard depth={46} className="bottom-[14%] right-[6%]">
        <p className="mb-2 text-[10px] text-black/45">ใช้ได้ทุกอุปกรณ์</p>
        <div className="flex items-center gap-1.5">
          {["#0a84ff", "#34c759", "#ff9500", "#7a7ae5"].map((c) => (
            <span
              key={c}
              className="h-6 w-6 rounded-lg"
              style={{ background: c, opacity: 0.85 }}
            />
          ))}
        </div>
      </FloatCard>
    </div>
  );
}

function FloatCard({
  children,
  className,
  depth,
}: {
  children: React.ReactNode;
  className?: string;
  /** Parallax travel in px at the layer edge. Higher = closer = moves more. */
  depth: number;
}) {
  const bobDelay = (depth % 7) * 0.4;
  const bobDur = 5 + (depth % 5);
  return (
    <div
      className={"absolute " + (className ?? "")}
      style={
        {
          transform:
            "translate3d(calc(var(--px) * " +
            depth +
            "px), calc(var(--py) * " +
            depth +
            "px), 0)",
          transition: "transform 300ms cubic-bezier(0.32,0.72,0,1)",
        } as React.CSSProperties
      }
    >
      <div
        className="rounded-2xl border border-black/[0.04] bg-white/90 px-4 py-3 shadow-card backdrop-blur-sm"
        style={{
          animation: `float-card-bob ${bobDur}s ease-in-out ${bobDelay}s infinite`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function FloatNote({
  children,
  className,
  depth,
}: {
  children: React.ReactNode;
  className?: string;
  depth: number;
}) {
  const bobDelay = (depth % 7) * 0.4;
  const bobDur = 5 + (depth % 5);
  return (
    <div
      className={"absolute " + (className ?? "")}
      style={
        {
          transform:
            "translate3d(calc(var(--px) * " +
            depth +
            "px), calc(var(--py) * " +
            depth +
            "px), 0) rotate(-5deg)",
          transition: "transform 300ms cubic-bezier(0.32,0.72,0,1)",
        } as React.CSSProperties
      }
    >
      <div
        className="max-w-[11rem] rounded-sm px-4 py-3 text-[12px] leading-relaxed text-black/70 shadow-card"
        style={{
          background: "#FEF3C7",
          fontFamily: "var(--font-anuphan), sans-serif",
          animation: `float-card-bob ${bobDur}s ease-in-out ${bobDelay}s infinite`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
