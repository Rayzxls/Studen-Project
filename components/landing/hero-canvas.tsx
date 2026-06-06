"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

/**
 * HeroCanvas — full-bleed R3F backdrop for the Section 1 hero
 * (ADR-0029 T1). Lazy-loaded (ssr:false), gated on prefers-reduced-motion
 * with a static brand-gradient fallback that is always painted so the
 * hero never blanks.
 */
const HeroScene = dynamic(() => import("./hero-scene"), { ssr: false });

export function HeroCanvas() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabled(!reduce);
  }, []);

  return (
    <div className="absolute inset-0 -z-0">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 70% 30%, rgba(10,132,255,0.16) 0%, transparent 60%), radial-gradient(50% 50% at 25% 70%, rgba(122,122,229,0.14) 0%, transparent 55%), radial-gradient(40% 40% at 85% 80%, rgba(232,166,70,0.12) 0%, transparent 60%)",
        }}
      />
      {enabled && (
        <div className="absolute inset-0">
          <HeroScene />
        </div>
      )}
    </div>
  );
}
