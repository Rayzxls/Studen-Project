"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * First-course walkthrough: dims the course page and cuts a hole around one
 * real control at a time, so the teacher learns where things are on the screen
 * they will actually use rather than in a separate tour screen.
 *
 * A step whose target is missing is skipped rather than pointing at nothing —
 * the tab bar is built from feature flags, so which controls exist varies.
 */

type Step = {
  /** Matched against the live DOM; a step with no match is skipped. */
  selector: string;
  title: string;
  body: string;
};

const STEPS: readonly Step[] = [
  {
    selector: '[data-guide="course-tabs"]',
    title: "ทุกอย่างของวิชาอยู่ในแถบนี้",
    body: "แต่ละแท็บคือส่วนหนึ่งของการสอน — โพสต์ในฟีด สั่งงาน เช็กชื่อ ให้คะแนน และดูรายชื่อสมาชิก",
  },
  {
    selector: '[data-guide="course-composer"]',
    title: "โพสต์และสั่งงานจากปุ่มนี้",
    body: "ใช้ปุ่มเดียวสำหรับประกาศ แจกเอกสาร และสั่งงาน นักเรียนจะเห็นในฟีดของวิชาทันที",
  },
  {
    selector: '[data-guide-tab="settings"]',
    title: "รหัสเข้าห้องและเวลาเรียนอยู่ในตั้งค่า",
    body: "แชร์รหัสให้นักเรียนเข้าห้อง และตั้งเวลาเรียนเพื่อให้วิชาขึ้นตารางสอนและเปิดการเช็กชื่อตามคาบ",
  },
];

const PADDING = 8;
const CARD_GAP = 12;
const CARD_WIDTH = 320;

type Rect = { top: number; left: number; width: number; height: number };

function readRect(selector: string): Rect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function TeacherSetupGuide({
  onFinish,
}: {
  /** Persists "seen" so the walkthrough does not return on the next visit. */
  onFinish: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  // Steps whose target is actually on this page, resolved once on mount.
  const [steps, setSteps] = useState<readonly Step[]>([]);

  // Deferred a frame so the first paint of the course page is already on
  // screen: the walkthrough points at real controls, so they have to exist and
  // be laid out before their positions can be read.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setMounted(true);
      setSteps(STEPS.filter((step) => readRect(step.selector) !== null));
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const step = steps[index];

  const measure = useCallback(() => {
    if (!step) return;
    setRect(readRect(step.selector));
  }, [step]);

  useEffect(() => {
    if (!step) return;
    document.querySelector(step.selector)?.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
    // The scroll settles asynchronously, so measure on the next frame and
    // again once it has come to rest.
    const raf = requestAnimationFrame(measure);
    const timer = window.setTimeout(measure, 320);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure, step]);

  const finish = useCallback(() => {
    setSteps([]);
    onFinish();
  }, [onFinish]);

  const next = useCallback(() => {
    setIndex((current) => {
      if (current + 1 >= steps.length) {
        finish();
        return current;
      }
      return current + 1;
    });
  }, [finish, steps.length]);

  useEffect(() => {
    if (steps.length === 0) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
      if (event.key === "Enter" || event.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [finish, next, steps.length]);

  if (!mounted || !step || !rect) return null;

  const hole = {
    top: rect.top - PADDING,
    left: rect.left - PADDING,
    width: rect.width + PADDING * 2,
    height: rect.height + PADDING * 2,
  };
  const below = hole.top + hole.height + CARD_GAP;
  const placeBelow = below + 180 < window.innerHeight;
  const cardTop = placeBelow ? below : Math.max(CARD_GAP, hole.top - 180);
  const cardLeft = Math.min(
    Math.max(CARD_GAP, hole.left),
    Math.max(CARD_GAP, window.innerWidth - CARD_WIDTH - CARD_GAP)
  );

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-guide-title"
      className="fixed inset-0 z-[100]"
    >
      {/* The cutout: one huge spread shadow dims everything except the hole. */}
      <div
        className="pointer-events-none absolute rounded-xl motion-safe:transition-all motion-safe:duration-[280ms]"
        style={{
          top: hole.top,
          left: hole.left,
          width: hole.width,
          height: hole.height,
          boxShadow:
            "0 0 0 9999px rgba(0,0,0,0.55), 0 0 0 2px var(--color-blue-500) inset",
        }}
      />

      {/* Clicking the dimmed area leaves the walkthrough. */}
      <button
        type="button"
        aria-label="ปิดคำแนะนำ"
        onClick={finish}
        className="absolute inset-0 h-full w-full cursor-default"
      />

      <div
        className="absolute rounded-2xl bg-surface p-4 shadow-lift"
        style={{ top: cardTop, left: cardLeft, width: CARD_WIDTH }}
      >
        <p className="text-xs font-medium text-ink-mute">
          ขั้นที่ {index + 1} จาก {steps.length}
        </p>
        <h2
          id="setup-guide-title"
          className="mt-1 font-semibold text-ink"
          style={{ letterSpacing: "-0.01em" }}
        >
          {step.title}
        </h2>
        <p className="mt-1.5 text-sm text-ink-soft">{step.body}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={finish}
            className="btn-ghost btn-sm text-ink-mute"
          >
            ข้ามคำแนะนำ
          </button>
          <button
            type="button"
            onClick={next}
            autoFocus
            className="btn-primary btn-sm"
          >
            {index + 1 >= steps.length ? "เริ่มใช้งาน" : "ถัดไป"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
