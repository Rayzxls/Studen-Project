"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

/**
 * HeroCanvas — client wrapper that lazy-loads the R3F HeroScene with
 * SSR disabled (WebGL can't render on the server) and gates it behind
 * prefers-reduced-motion. When motion is reduced — or before the canvas
 * mounts — a static brand gradient stands in, so the hero never blanks.
 *
 * ADR-0029 § 3: three/R3F ships only on the landing route, lazy.
 */
const HeroScene = dynamic(() => import("./hero-scene"), { ssr: false });

export function HeroCanvas() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    // Reading a platform media query at mount and gating the WebGL canvas
    // on it is the canonical effect use (sync external system -> React).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabled(!reduce);
  }, []);

  return (
    <div className="absolute inset-0 -z-0">
      {/* Static gradient fallback — always painted; the canvas layers over it. */}
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
