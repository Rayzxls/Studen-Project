"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import {
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  LockKeyhole,
  Send,
  Sparkles,
  UsersRound,
} from "lucide-react";

type ScenarioTone = "blue" | "amber" | "teal" | "coral";
type ScenarioVisual = "attendance" | "review" | "submit" | "publish";

type Scenario = {
  eyebrow: string;
  title: string;
  body: string;
  metric: string;
  cta: string;
  tone: ScenarioTone;
  visual: ScenarioVisual;
};

const SCENARIOS: Scenario[] = [
  {
    eyebrow: "เริ่มคาบ",
    title: "ครูเห็นคาบวันนี้ก่อนเริ่มสอน",
    body: "เปิดคาบ เช็คชื่อ และรู้ทันทีว่าใครต้องตาม โดยไม่ต้องเปิดหลายหน้า",
    metric: "มา 28 · ขาด 2 · ลา 1",
    cta: "ดูคาบเรียน",
    tone: "blue",
    visual: "attendance",
  },
  {
    eyebrow: "งานค้างตรวจ",
    title: "งานที่ส่งใหม่ถูกดันขึ้นมาให้ตรวจต่อ",
    body: "ครูเห็นว่างานค้างอยู่ชิ้นไหน ใครส่งแล้ว และตรวจคนถัดไปได้ต่อเนื่อง",
    metric: "รอตรวจ 6 งาน",
    cta: "ตรวจงานต่อ",
    tone: "amber",
    visual: "review",
  },
  {
    eyebrow: "ฝั่งนักเรียน",
    title: "ส่งงานแล้วรู้สถานะทันที",
    body: "นักเรียนเห็นว่าส่งแล้ว แก้ไขได้ และย้อนดูประวัติการส่งของตัวเองชัดเจน",
    metric: "ส่งแล้ว · แก้ไขได้",
    cta: "ดูงานของฉัน",
    tone: "teal",
    visual: "submit",
  },
  {
    eyebrow: "ประกาศคะแนน",
    title: "คะแนนถึงนักเรียนแบบเป็นส่วนตัว",
    body: "เมื่อครูเผยแพร่ คะแนนและหมายเหตุจะแสดงเฉพาะเจ้าของงานเท่านั้น",
    metric: "15/15 · เห็นเฉพาะฉัน",
    cta: "ดูผลลัพธ์",
    tone: "coral",
    visual: "publish",
  },
];

export function ShowcaseBento() {
  const [activeIndex, setActiveIndex] = useState(0);

  const moveCard = (direction: -1 | 1) => {
    setActiveIndex((current) => {
      const next = current + direction;
      if (next < 0) return SCENARIOS.length - 1;
      if (next >= SCENARIOS.length) return 0;
      return next;
    });
  };

  return (
    <section id="features" className="scenario-carousel-section px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="scenario-carousel-heading mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            เส้นทางการใช้งานจริง
          </span>
          <h2 className="mt-4 text-balance text-4xl font-semibold md:text-5xl">
            หนึ่งคาบเรียน ไหลเป็นเรื่องเดียว
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed">
            เลื่อนดูจังหวะสำคัญตั้งแต่ครูเปิดคาบ นักเรียนส่งงาน จนถึงประกาศคะแนน
            ผ่านการ์ดสถานการณ์ที่ช่วยให้เห็นภาพการใช้จริงในห้องเรียน
          </p>
        </div>

        <div className="scenario-carousel-shell mt-12">
          <button
            type="button"
            className="scenario-carousel-control scenario-carousel-control-left"
            aria-label="เลื่อนการ์ดก่อนหน้า"
            onClick={() => moveCard(-1)}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div
            className="scenario-carousel-rail scenario-carousel-stack"
            aria-label="ตัวอย่างสถานการณ์การใช้งาน Beagle Classroom"
          >
            {SCENARIOS.map((scenario, index) => (
              <ScenarioCard
                key={scenario.title}
                scenario={scenario}
                index={index}
                activeIndex={activeIndex}
                onSelect={() => setActiveIndex(index)}
              />
            ))}
          </div>

          <button
            type="button"
            className="scenario-carousel-control scenario-carousel-control-right"
            aria-label="เลื่อนการ์ดถัดไป"
            onClick={() => moveCard(1)}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="scenario-carousel-dots" aria-label="เลือกการ์ด">
          {SCENARIOS.map((scenario, index) => (
            <button
              key={scenario.title}
              type="button"
              className={
                index === activeIndex
                  ? "scenario-carousel-dot is-active"
                  : "scenario-carousel-dot"
              }
              aria-label={`ไปที่การ์ด ${index + 1}: ${scenario.eyebrow}`}
              aria-current={index === activeIndex ? "true" : undefined}
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ScenarioCard({
  scenario,
  index,
  activeIndex,
  onSelect,
}: {
  scenario: Scenario;
  index: number;
  activeIndex: number;
  onSelect: () => void;
}) {
  const offset = getCircularOffset(index, activeIndex, SCENARIOS.length);
  const depth = Math.abs(offset);
  const isActive = offset === 0;
  const isVisible = depth <= 2;
  const stackStyle = {
    "--scenario-x": `${offset * 116}px`,
    "--scenario-y": `${depth * 16}px`,
    "--scenario-z": `${-depth * 70}px`,
    "--scenario-rotate": `${offset * -3.5}deg`,
    "--scenario-hover-rotate": `${offset * -2.5}deg`,
    "--scenario-scale": `${1 - Math.min(depth * 0.075, 0.2)}`,
    "--scenario-opacity": `${!isVisible ? 0 : 1 - depth * 0.14}`,
    "--scenario-blur": `${depth > 1 ? 1.2 : 0}px`,
    "--scenario-hover-blur": `${depth > 1 ? 0.65 : 0}px`,
    zIndex: 20 - depth,
  } as CSSProperties;

  return (
    <article
      className={`scenario-card scenario-card-${scenario.tone}${
        isActive ? " is-active" : ""
      }`}
      aria-label={`${index + 1}. ${scenario.title}`}
      aria-hidden={!isVisible}
      style={stackStyle}
      data-offset={offset}
      data-active={isActive ? "true" : "false"}
      role={!isActive && isVisible ? "button" : undefined}
      tabIndex={!isActive && isVisible ? 0 : -1}
      onClick={() => {
        if (!isActive) onSelect();
      }}
      onKeyDown={(event) => {
        if (isActive) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="scenario-card-copy">
        <span className="scenario-card-eyebrow">{scenario.eyebrow}</span>
        <h3>{scenario.title}</h3>
        <p>{scenario.body}</p>
        <div className="scenario-card-meta">
          <span>{scenario.metric}</span>
          <span className="inline-flex items-center gap-1">
            {scenario.cta}
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
      <ScenarioVisual type={scenario.visual} />
    </article>
  );
}

function getCircularOffset(index: number, activeIndex: number, total: number) {
  let offset = index - activeIndex;
  const half = total / 2;
  if (offset > half) offset -= total;
  if (offset < -half) offset += total;
  return offset;
}

function ScenarioVisual({ type }: { type: ScenarioVisual }) {
  if (type === "attendance") {
    return (
      <div className="scenario-visual scenario-phone">
        <div className="scenario-phone-bar" />
        <div className="scenario-phone-screen">
          <div className="scenario-screen-header">
            <CalendarCheck2 className="h-4 w-4" />
            <span>คาบวันนี้</span>
          </div>
          <div className="scenario-attendance-grid">
            <MiniMetric label="มา" value="28" />
            <MiniMetric label="ขาด" value="2" />
            <MiniMetric label="ลา" value="1" />
          </div>
          {["ธนภัทร พิลาดี", "วรินทร์ แก้วใส", "กานต์ชนก มีสุข"].map(
            (name, index) => (
              <div className="scenario-mini-row" key={name}>
                <span className="scenario-avatar">{name[0]}</span>
                <span>{name}</span>
                <span className={index === 1 ? "is-warning" : "is-ok"}>
                  {index === 1 ? "ขาด" : "มา"}
                </span>
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  if (type === "review") {
    return (
      <div className="scenario-visual scenario-board">
        <div className="scenario-board-top">
          <ClipboardCheck className="h-5 w-5" />
          <div>
            <strong>คิวตรวจงาน</strong>
            <span>ต่อจากคนล่าสุดทันที</span>
          </div>
        </div>
        <div className="scenario-stack">
          {[
            ["การบ้านบทที่ 1", "รุ่น 1 · ส่งสาย"],
            ["สรุปบทเรียน", "แนบรูป 2 ไฟล์"],
            ["ใบงานกลุ่ม", "รอตรวจ"],
          ].map(([title, meta], index) => (
            <div className="scenario-review-row" key={title}>
              <span className="scenario-number">{index + 1}</span>
              <div>
                <strong>{title}</strong>
                <span>{meta}</span>
              </div>
              <CheckCircle2 className="ml-auto h-4 w-4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "submit") {
    return (
      <div className="scenario-visual scenario-submit-sheet">
        <div className="scenario-sheet-handle" />
        <div className="flex items-center justify-between gap-4">
          <div>
            <strong>งานของคุณ</strong>
            <span>สถานะล่าสุด</span>
          </div>
          <span className="scenario-status-good">ส่งแล้ว</span>
        </div>
        <div className="scenario-upload-row">
          <FileText className="h-5 w-5" />
          <div>
            <strong>summary.pdf</strong>
            <span>อัปโหลดแล้ว · 420 KB</span>
          </div>
        </div>
        <button type="button" className="scenario-fake-button">
          <Send className="h-4 w-4" />
          ส่งใหม่แทนเวอร์ชันเดิม
        </button>
      </div>
    );
  }

  return (
    <div className="scenario-visual scenario-score-card">
      <div className="scenario-score-lock">
        <LockKeyhole className="h-5 w-5" />
        เห็นเฉพาะเจ้าของงาน
      </div>
      <div className="scenario-score-main">
        <span>คะแนนของฉัน</span>
        <strong>15/15</strong>
      </div>
      <div className="scenario-feedback">
        <Clock3 className="h-4 w-4" />
        <span>เผยแพร่เมื่อ 13 มิ.ย. · ครูบันทึก audit แล้ว</span>
      </div>
      <div className="scenario-mini-row">
        <span className="scenario-avatar">
          <UsersRound className="h-4 w-4" />
        </span>
        <span>เพื่อนร่วมห้อง</span>
        <span className="is-muted">ไม่แสดง</span>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="scenario-mini-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
