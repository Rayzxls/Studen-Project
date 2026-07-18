"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { BeagleLogo } from "@/components/landing/beagle-logo";

/**
 * AuroraShowcase — a pure brand "showpiece" (replaces the old roles strip).
 *
 * No information to present: just a slow-drifting aurora of brand-coloured
 * light that pools toward the cursor, with a single quiet brand line. The
 * band base is the theme surface and every glow is a brand hue, so the same
 * scene reads as a soft pastel aurora on light, a luminous one on dark, and
 * a warm one on cream — no per-theme tuning.
 *
 * Motion: blobs drift via the shared blob-drift keyframes; the cursor pools
 * a radial glow and parallaxes the blobs on two depths. The global
 * reduced-motion block neutralises the drift, and the pointer handler bails
 * under reduced-motion / coarse pointers.
 */

type Blob = {
  hex: string;
  x: string;
  y: string;
  size: string;
  drift: "a" | "b" | "c";
  dur: number;
  delay: number;
  depth: number;
};

const BLOBS: Blob[] = [
  {
    hex: "#0a84ff",
    x: "16%",
    y: "20%",
    size: "34rem",
    drift: "a",
    dur: 22,
    delay: 0,
    depth: 28,
  },
  {
    hex: "#7a7ae5",
    x: "82%",
    y: "16%",
    size: "30rem",
    drift: "b",
    dur: 26,
    delay: 1.4,
    depth: 36,
  },
  {
    hex: "#3cb4ac",
    x: "22%",
    y: "84%",
    size: "32rem",
    drift: "c",
    dur: 24,
    delay: 0.8,
    depth: 30,
  },
  {
    hex: "#34c759",
    x: "84%",
    y: "82%",
    size: "27rem",
    drift: "a",
    dur: 28,
    delay: 2.1,
    depth: 22,
  },
  {
    hex: "#5eaedb",
    x: "50%",
    y: "48%",
    size: "26rem",
    drift: "b",
    dur: 20,
    delay: 1.0,
    depth: 16,
  },
];

export function AuroraShowcase() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    function onMove(e: PointerEvent) {
      if (e.pointerType === "touch") return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el!.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        el!.style.setProperty("--mx", `${(x * 100).toFixed(2)}%`);
        el!.style.setProperty("--my", `${(y * 100).toFixed(2)}%`);
        el!.style.setProperty("--px", (x - 0.5).toFixed(3));
        el!.style.setProperty("--py", (y - 0.5).toFixed(3));
      });
    }
    function reset() {
      el!.style.setProperty("--mx", "50%");
      el!.style.setProperty("--my", "50%");
      el!.style.setProperty("--px", "0");
      el!.style.setProperty("--py", "0");
    }
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", reset);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", reset);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section className="px-6 py-24">
      <div
        ref={ref}
        className="relative mx-auto flex min-h-[28rem] max-w-6xl items-center justify-center overflow-hidden rounded-[2.5rem] ring-1 ring-inset ring-black/[0.06]"
        style={
          {
            background: "var(--color-surface)",
            "--mx": "50%",
            "--my": "50%",
            "--px": "0",
            "--py": "0",
          } as CSSProperties
        }
      >
        {/* Aurora blobs */}
        {BLOBS.map((b, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="pointer-events-none absolute rounded-full"
            style={{
              width: b.size,
              height: b.size,
              left: b.x,
              top: b.y,
              background: `radial-gradient(circle, ${b.hex} 0%, transparent 68%)`,
              opacity: 0.5,
              filter: "blur(64px)",
              transform: `translate(-50%, -50%) translate3d(calc(var(--px) * ${b.depth}px), calc(var(--py) * ${b.depth}px), 0)`,
              transition: "transform 400ms cubic-bezier(0.32,0.72,0,1)",
              animation: `blob-drift-${b.drift} ${b.dur}s ease-in-out ${b.delay}s infinite`,
            }}
          />
        ))}

        {/* Cursor pool — a brand glow that follows the pointer */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(26rem circle at var(--mx) var(--my), color-mix(in srgb, #0a84ff 28%, transparent) 0%, transparent 58%)",
          }}
        />

        {/* Legibility veil — a soft surface disc keeps the line readable on
            every theme without dimming the aurora at the edges. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(58% 58% at 50% 50%, color-mix(in srgb, var(--color-surface) 68%, transparent) 0%, transparent 74%)",
          }}
        />

        {/* Brand moment */}
        <div className="relative z-10 px-6 text-center">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium backdrop-blur"
            style={{
              background:
                "color-mix(in srgb, var(--color-surface) 78%, transparent)",
              color: "var(--color-ink-soft)",
              boxShadow: "inset 0 0 0 1px var(--color-hairline)",
            }}
          >
            <BeagleLogo className="h-4 w-4" />
            Beagle Classroom
          </span>
          <h2
            className="mt-5 text-balance text-4xl font-semibold md:text-6xl"
            style={{
              color: "var(--color-ink)",
              letterSpacing: "-0.03em",
              lineHeight: 1.35,
            }}
          >
            ใส่ใจในทุกรายละเอียด
          </h2>
          <p
            className="mx-auto mt-4 max-w-md text-base leading-relaxed"
            style={{ color: "var(--color-ink-soft)" }}
          >
            ตั้งแต่สี การจัดวาง จนถึงจังหวะการเคลื่อนไหว —
            ออกแบบมาให้รู้สึกดีในทุกการใช้งาน
          </p>
        </div>
      </div>
    </section>
  );
}
