"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import type { TourStep } from "@/lib/guide/tours";

/**
 * Guided walkthrough: dims the page and cuts a hole around one real control at
 * a time, so a person learns the screen they will actually use rather than a
 * separate tour screen.
 *
 * Content comes from `lib/guide/tours`, so this component only renders and
 * sequences. A step whose target is missing is skipped rather than pointing at
 * nothing — which controls exist depends on feature flags and on what the
 * person has created so far.
 */

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

export function GuideTour({
  steps: authored,
  onFinish,
}: {
  steps: readonly TourStep[];
  /** Persists "seen" so the walkthrough does not return on the next visit. */
  onFinish: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  // Steps whose target is actually on this page, resolved once on mount.
  const [steps, setSteps] = useState<readonly TourStep[]>([]);

  // Deferred a frame so the first paint of the course page is already on
  // screen: the walkthrough points at real controls, so they have to exist and
  // be laid out before their positions can be read.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setMounted(true);
      setSteps(authored.filter((step) => readRect(step.selector) !== null));
    });
    return () => cancelAnimationFrame(raf);
    // Resolved once: re-filtering mid-tour would renumber the steps under the
    // person's feet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // The decision is made here rather than inside a setIndex updater: React runs
  // an updater during render, so finishing from inside one set state on the
  // parent mid-render.
  // The decision is made here rather than inside a setIndex updater: React runs
  // an updater during render, so finishing from inside one set state on the
  // parent mid-render.
  const next = useCallback(() => {
    if (index + 1 >= steps.length) {
      finish();
      return;
    }
    setIndex(index + 1);
  }, [finish, index, steps.length]);

  useEffect(() => {
    if (steps.length === 0) return;
    // Enter is deliberately not handled here. The advance button is focused, so
    // the browser already activates it on Enter; handling the key here as well
    // ran `next` twice and skipped a step.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
      if (event.key === "ArrowRight") next();
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
