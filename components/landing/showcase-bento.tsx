"use client";

import {
  BarChart3,
  CalendarCheck2,
  LayoutGrid,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Tilt3D } from "@/components/motion/tilt-3d";

/**
 * ShowcaseBento — Section 2 of the Beagle Classroom landing.
 *
 * Apple-style bento grid presenting what the system actually does, each
 * tile carrying a small live-styled mock of the real UI (gradebook,
 * attendance ring, feed post, dashboard KPIs, course-colour grid, audit).
 * Tiles tilt on hover (Tilt3D) and reveal on scroll-in (EntryStagger).
 */
export function ShowcaseBento() {
  return (
    <section id="features" className="relative px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            <Sparkles className="h-3.5 w-3.5" />
            ทุกอย่างของห้องเรียน ในที่เดียว
          </span>
          <h2
            className="mt-4 text-4xl font-semibold text-black md:text-5xl"
            style={{ letterSpacing: "-0.03em", lineHeight: 1.1 }}
          >
            ระบบของเรา ทำอะไรได้บ้าง
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-black/60">
            เช็คชื่อ กรอกคะแนน ส่งงาน ฟีดประกาศ และผลการเรียน รวมเป็น workspace
            เดียวที่ครูเป็นเจ้าของ นักเรียนเห็นเฉพาะของตัวเอง
          </p>
        </div>

        {/* Plain grid (not EntryStagger) so each Tilt3D — which carries the
            col-span — is the direct grid item and the bento layout
            resolves. Tilt hover is the per-tile interaction. */}
        <div className="grid grid-cols-1 gap-4 md:auto-rows-[15rem] md:grid-cols-6">
          {/* Gradebook — wide hero tile */}
          <BentoTile className="md:col-span-4 md:row-span-1" tone="green">
            <TileHead
              icon={<BarChart3 className="h-4 w-4" />}
              tone="green"
              eyebrow="กรอกคะแนน"
              title="เกรดคำนวณให้อัตโนมัติ"
            />
            <MockGradebook />
          </BentoTile>

          {/* Attendance — square */}
          <BentoTile className="md:col-span-2" tone="blue">
            <TileHead
              icon={<CalendarCheck2 className="h-4 w-4" />}
              tone="blue"
              eyebrow="เช็คชื่อ"
              title="มาเรียนกี่ %"
            />
            <MockAttendance />
          </BentoTile>

          {/* Feed — square */}
          <BentoTile className="md:col-span-2" tone="orange">
            <TileHead
              icon={<MessagesSquare className="h-4 w-4" />}
              tone="orange"
              eyebrow="ฟีดห้องเรียน"
              title="ประกาศ การบ้าน เอกสาร"
            />
            <MockFeed />
          </BentoTile>

          {/* Course colours — wide */}
          <BentoTile className="md:col-span-4" tone="violet">
            <TileHead
              icon={<LayoutGrid className="h-4 w-4" />}
              tone="violet"
              eyebrow="แต่ละวิช มีสีของตัวเอง"
              title="หาห้องเรียนเจอได้ในพริบตา"
            />
            <MockCourseColors />
          </BentoTile>

          {/* Audit — wide */}
          <BentoTile className="md:col-span-3" tone="blue">
            <TileHead
              icon={<ShieldCheck className="h-4 w-4" />}
              tone="blue"
              eyebrow="ตรวจสอบได้ทุกการแก้ไข"
              title="Audit log ทุก mutation"
            />
            <p className="mt-2 text-sm leading-relaxed text-black/55">
              ครูแก้คะแนนหลังเผยแพร่ต้องระบุเหตุผล ระบบบันทึกทุกครั้ง
              โรงเรียนย้อนดูได้เสมอ
            </p>
          </BentoTile>

          {/* Dashboards — wide */}
          <BentoTile className="md:col-span-3" tone="green">
            <TileHead
              icon={<Sparkles className="h-4 w-4" />}
              tone="green"
              eyebrow="แดชบอร์ดของแต่ละบทบาท"
              title="ครู · นักเรียน · ผู้ดูแล"
            />
            <MockKpis />
          </BentoTile>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Tile shell
// ─────────────────────────────────────────────────────────────

type Tone = "blue" | "green" | "orange" | "violet";

function BentoTile({
  children,
  className,
  tone,
}: {
  children: React.ReactNode;
  className?: string;
  tone: Tone;
}) {
  const glow: Record<Tone, string> = {
    blue: "rgba(10,132,255,0.10)",
    green: "rgba(52,199,89,0.10)",
    orange: "rgba(255,149,0,0.10)",
    violet: "rgba(122,122,229,0.12)",
  };
  return (
    <Tilt3D maxDeg={5} className={className}>
      <div
        className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-black/[0.05] bg-white p-6 shadow-card"
        style={{
          backgroundImage: `radial-gradient(120% 80% at 100% 0%, ${glow[tone]} 0%, transparent 55%)`,
        }}
      >
        {children}
      </div>
    </Tilt3D>
  );
}

function TileHead({
  icon,
  eyebrow,
  title,
  tone,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  tone: Tone;
}) {
  const chip: Record<Tone, string> = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    orange: "bg-orange-50 text-orange-700",
    violet: "bg-[#eff0fe] text-[#3730a3]",
  };
  return (
    <div className="mb-3">
      <span
        className={
          "inline-flex h-8 w-8 items-center justify-center rounded-xl " +
          chip[tone]
        }
      >
        {icon}
      </span>
      <p className="mt-3 text-[11px] font-medium text-black/45">{eyebrow}</p>
      <h3
        className="text-lg font-semibold text-black"
        style={{ letterSpacing: "-0.02em" }}
      >
        {title}
      </h3>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Mock UI fragments — styled to mirror the real product surfaces
// ─────────────────────────────────────────────────────────────

function MockGradebook() {
  const rows = [
    { name: "รายวินทร์ ก.", score: 92, tone: "bg-green-500" },
    { name: "ธนกร พ.", score: 78, tone: "bg-blue-500" },
    { name: "ปาลิดา ส.", score: 64, tone: "bg-orange-500" },
  ];
  return (
    <div className="mt-auto space-y-2">
      {rows.map((r) => (
        <div
          key={r.name}
          className="flex items-center gap-3 rounded-xl bg-black/[0.02] px-3 py-2"
        >
          <span className="flex-1 text-xs font-medium text-black/70">
            {r.name}
          </span>
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-black/[0.06]">
            <div
              className={"h-full rounded-full " + r.tone}
              style={{ width: `${r.score}%` }}
            />
          </div>
          <span className="w-8 text-right text-xs font-semibold text-black">
            {r.score}
          </span>
        </div>
      ))}
    </div>
  );
}

function MockAttendance() {
  return (
    <div className="mt-auto flex items-center justify-center">
      <div className="relative h-28 w-28">
        <svg viewBox="0 0 36 36" className="h-28 w-28 -rotate-90">
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="rgba(0,0,0,0.06)"
            strokeWidth="3.5"
          />
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="#0a84ff"
            strokeWidth="3.5"
            strokeDasharray="94.2"
            strokeDashoffset="11.3"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-2xl font-semibold text-black"
            style={{ letterSpacing: "-0.02em" }}
          >
            88%
          </span>
          <span className="text-[10px] text-black/45">มาเรียน</span>
        </div>
      </div>
    </div>
  );
}

function MockFeed() {
  return (
    <div className="mt-auto space-y-2">
      <div className="rounded-xl border border-black/[0.05] bg-white px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-[9px] font-semibold text-orange-700">
            สใ
          </span>
          <span className="text-[11px] font-medium text-black">ครูสมชาย</span>
          <span className="ml-auto rounded-full bg-orange-50 px-1.5 py-0.5 text-[8px] font-medium text-orange-700">
            ประกาศ
          </span>
        </div>
        <p className="mt-1.5 text-[10px] leading-relaxed text-black/55">
          พรุ่งนี้สอบเก็บคะแนนบทที่ 3 นะครับ
        </p>
      </div>
      <div className="rounded-xl border border-black/[0.05] bg-white px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[8px] font-medium text-blue-700">
            การบ้าน
          </span>
          <span className="text-[10px] text-black/55">แบบฝึกหัด 3.2</span>
        </div>
      </div>
    </div>
  );
}

function MockCourseColors() {
  const colors = [
    "#f56c7c",
    "#f58e6e",
    "#e8a646",
    "#94c944",
    "#3cb4ac",
    "#5eaedb",
    "#7a7ae5",
    "#b574d6",
  ];
  const names = [
    "ภาษาไทย",
    "สังคม",
    "คณิต",
    "วิทย์",
    "อังกฤษ",
    "ศิลปะ",
    "พละ",
    "เทคโน",
  ];
  return (
    <div className="mt-auto grid grid-cols-4 gap-2">
      {colors.map((c, i) => (
        <div
          key={c}
          className="overflow-hidden rounded-xl border border-black/[0.05] bg-white"
        >
          <div className="h-7" style={{ background: c }} />
          <p className="px-2 py-1 text-[9px] font-medium text-black/60">
            {names[i]}
          </p>
        </div>
      ))}
    </div>
  );
}

function MockKpis() {
  const kpis = [
    { label: "วิชาที่สอน", value: "6", tone: "text-blue-700" },
    { label: "นักเรียน", value: "182", tone: "text-black" },
    { label: "งานรอตรวจ", value: "3", tone: "text-orange-700" },
  ];
  return (
    <div className="mt-auto grid grid-cols-3 gap-2">
      {kpis.map((k) => (
        <div key={k.label} className="rounded-xl bg-black/[0.02] p-3">
          <p className="text-[10px] text-black/45">{k.label}</p>
          <p
            className={"mt-1 text-xl font-semibold " + k.tone}
            style={{ letterSpacing: "-0.02em" }}
          >
            {k.value}
          </p>
        </div>
      ))}
    </div>
  );
}
