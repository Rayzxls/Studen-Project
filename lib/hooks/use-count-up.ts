"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useCountUp — animates a number from 0 to `target` on mount and on every
 * subsequent target change. Used by dashboard KPI cards (ADR-0028 § 6).
 *
 * Honours `prefers-reduced-motion: reduce` by snapping to the final value
 * immediately. The default 600ms duration sits in the spring-large band —
 * feedback motion, not ambient.
 *
 * The curve is ease-out-quart, which front-loads progress so the number
 * reaches readable territory quickly and decelerates at the end — feels
 * snappy rather than slow on dashboards.
 *
 * Note: when `target` changes mid-animation, the animation restarts from
 * `from` (default 0). Dashboards rarely retarget mid-animation, so the
 * simpler restart-from-zero matches the typical use without ref bookkeeping.
 */
export interface UseCountUpOptions {
  /** Animation duration in ms. Default 600ms. */
  duration?: number;
  /** Starting value each animation cycle. Default 0. */
  from?: number;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function useCountUp(
  target: number,
  options: UseCountUpOptions = {}
): number {
  const { duration = 600, from = 0 } = options;
  // Initial value depends on motion preference — derived at mount.
  const [value, setValue] = useState<number>(() =>
    prefersReducedMotion() ? target : from
  );
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (prefersReducedMotion()) {
      // Snap to the new target on subsequent target changes. The setState
      // here IS the animation surface, not a derived-state ping-pong.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(target);
      return;
    }

    let startTime: number | null = null;
    const tick = (now: number) => {
      if (startTime === null) startTime = now;
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      // ease-out-quart — front-loaded, decelerates at the end.
      const eased = 1 - Math.pow(1 - t, 4);
      const next = from + (target - from) * eased;
       
      setValue(next);
      if (t < 1) {
        rafRef.current = window.requestAnimationFrame(tick);
      } else {
         
        setValue(target);
        rafRef.current = null;
      }
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, from]);

  return value;
}

/**
 * Convenience formatter — rounds to integer and uses Thai locale grouping
 * (`th-TH`). Most KPI cards in the system want this exact shape.
 */
export function formatCountUp(value: number): string {
  return Math.round(value).toLocaleString("th-TH");
}
