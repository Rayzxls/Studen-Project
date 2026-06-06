"use client";

import { useRef, type ReactNode } from "react";

/**
 * Tilt3D — CSS 3D pointer-parallax wrapper (ADR-0029 § 2, T1/T2).
 *
 * On pointer move the child rotates up to ±maxDeg around X/Y toward the
 * cursor, creating a subtle "card floating under glass" feel. Pure CSS
 * transform driven by two CSS vars set on a ref — no React re-render per
 * frame, no animation library.
 *
 * Discipline (ADR-0029):
 *  - Max 8° rotation by default — premium, not carnival.
 *  - Returns to flat on pointer-leave via --spring-standard.
 *  - Touch / coarse pointers: tilt disabled (the @media below), so phones
 *    get the press-scale feedback only, never a stuck tilt.
 *  - prefers-reduced-motion: the transform is suppressed entirely by the
 *    globals.css reduced-motion block (transition + transform reset).
 */
export interface Tilt3DProps {
  children: ReactNode;
  /** Max rotation in degrees. Default 8. */
  maxDeg?: number;
  /** Extra class names on the perspective wrapper. */
  className?: string;
  /** Lift the card toward the viewer on hover (px). Default 0 (no z-lift). */
  liftPx?: number;
}

export function Tilt3D({
  children,
  maxDeg = 8,
  className,
  liftPx = 0,
}: Tilt3DProps) {
  const innerRef = useRef<HTMLDivElement | null>(null);

  function handleMove(e: React.PointerEvent<HTMLDivElement>) {
    // Coarse pointers (touch) never tilt — avoids a stuck transform.
    if (e.pointerType === "touch") return;
    const el = innerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width; // 0..1
    const py = (e.clientY - rect.top) / rect.height; // 0..1
    // Map to -1..1, invert Y so moving up tilts the top toward you.
    const ry = (px - 0.5) * 2 * maxDeg;
    const rx = -(py - 0.5) * 2 * maxDeg;
    el.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
    el.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
    el.style.setProperty("--tz", `${liftPx}px`);
  }

  function reset() {
    const el = innerRef.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--tz", "0px");
  }

  return (
    <div
      className={className}
      style={{ perspective: "1000px" }}
      onPointerMove={handleMove}
      onPointerLeave={reset}
    >
      <div
        ref={innerRef}
        style={{
          transform:
            "rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) translateZ(var(--tz, 0px))",
          transformStyle: "preserve-3d",
          transition:
            "transform var(--duration-spring-standard, 180ms) var(--ease-spring, ease-out)",
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </div>
  );
}
