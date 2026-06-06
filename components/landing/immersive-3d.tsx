"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

/**
 * Immersive3D — the dedicated home for the heavy R3F scene (ADR-0029 T1).
 *
 * Moved out of the hero (where it overwhelmed the message) into its own
 * full-width band on a deep tinted surface, so the glossy floating shapes
 * pop as a deliberate "craft" moment with supporting copy. Lazy-loaded
 * (ssr:false) + gated on prefers-reduced-motion (static gradient
 * fallback).
 */
const HeroScene = dynamic(() => import("./hero-scene"), { ssr: false });

export function Immersive3D() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabled(!reduce);
  }, []);

  return (
    <section className="px-6 py-20">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-[#0b1220] shadow-card">
        {/* Deep gradient base so the shapes read as glossy + lit */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 70% at 75% 30%, rgba(10,132,255,0.35) 0%, transparent 60%), radial-gradient(50% 60% at 20% 80%, rgba(122,122,229,0.30) 0%, transparent 60%), radial-gradient(40% 50% at 50% 50%, rgba(232,166,70,0.16) 0%, transparent 60%)",
          }}
        />

        {/* 3D canvas */}
        <div className="absolute inset-0">{enabled && <HeroScene />}</div>

        {/* Copy overlay */}
        <div className="relative z-10 flex min-h-[28rem] flex-col items-center justify-center px-8 py-20 text-center md:min-h-[34rem]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm">
            ใส่ใจทุกรายละเอียด
          </span>
          <h2
            className="mt-5 max-w-2xl text-balance text-4xl font-semibold text-white md:text-5xl"
            style={{ letterSpacing: "-0.03em", lineHeight: 1.1 }}
          >
            ออกแบบมาให้รู้สึกดี
            <br />
            ทุกครั้งที่สัมผัส
          </h2>
          <p className="mt-4 max-w-md text-balance text-base leading-relaxed text-white/70">
            ลื่นไหล ตอบสนองทันที และสวยงามในทุกอุปกรณ์ —
            เครื่องมือที่ครูและนักเรียนอยากเปิดใช้ทุกวัน
          </p>
        </div>
      </div>
    </section>
  );
}
