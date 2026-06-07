"use client";

import { useRef, type ReactNode } from "react";

/**
 * Tilt3D — CSS 3D pointer-parallax wrapper (ADR-0029 § 2, T1/T2).
 *
 * On pointer move the child rotates up to ±maxDeg around X/Y toward the
 * cursor. Pure CSS transform driven by CSS vars on a ref — no React
 * re-render per frame, no animation library.
 *
 * Robustness notes (fixes the rounded-corner clipping bug):
 *  - Both wrappers are `h-full` + `block` so a grid cell's height passes
 *    straight through to the card; the card never gets a collapsed
 *    backing.
 *  - `transform-style: flat` (NOT preserve-3d). The card is a flat
 *    surface being rotated; preserve-3d created a 3D rendering context
 *    that Chrome mis-clipped on rounded corners.
 *  - `will-change` is only set while actively tilting and cleared on
 *    rest, so a resting card composites normally (a permanent
 *    will-change layer was clipping the rounded border).
 *  - Touch / coarse pointers never tilt (no stuck transform).
 *  - prefers-reduced-motion: the global reduced-motion block neutralises
 *    the transition; we also never apply a non-zero rotation because the
 *    pointer handler is the only thing that sets it.
 */
export interface Tilt3DProps {
  children: ReactNode;
  /** Max rotation in degrees. Default 6. */
  maxDeg?: number;
  /** Extra class names on the perspective wrapper. */
  className?: string;
}

export function Tilt3D({ children, maxDeg = 6, className }: Tilt3DProps) {
  const innerRef = useRef<HTMLDivElement | null>(null);

  function handleMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "touch") return;
    const el = innerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const ry = (px - 0.5) * 2 * maxDeg;
    const rx = -(py - 0.5) * 2 * maxDeg;
    el.style.willChange = "transform";
    el.style.transform = `perspective(1000px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
  }

  function reset() {
    const el = innerRef.current;
    if (!el) return;
    el.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg)";
    // Drop the compositing layer once the spring-back finishes so a
    // resting card renders its rounded corners crisply.
    window.setTimeout(() => {
      if (innerRef.current) innerRef.current.style.willChange = "auto";
    }, 220);
  }

  return (
    <div
      className={"h-full" + (className ? " " + className : "")}
      onPointerMove={handleMove}
      onPointerLeave={reset}
    >
      <div
        ref={innerRef}
        className="h-full"
        style={{
          transformStyle: "flat",
          transition:
            "transform var(--duration-spring-standard, 180ms) var(--ease-spring, ease-out)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
