"use client";

import { useState, useTransition } from "react";

import type { TourId, TourStep } from "@/lib/guide/tours";
import { GuideTour } from "./guide-tour";

/**
 * Bridges a walkthrough to its Server Action. The overlay closes as soon as the
 * person finishes or skips, without waiting for the write — the write only
 * decides whether the tour returns on a later visit, so making them wait for it
 * would be latency with nothing behind it.
 */
export function GuideTourMount({
  tourId,
  steps,
  markSeen,
}: {
  tourId: TourId;
  steps: readonly TourStep[];
  markSeen: (tourId: TourId) => Promise<void>;
}) {
  const [done, setDone] = useState(false);
  const [, startTransition] = useTransition();

  if (done) return null;

  return (
    <GuideTour
      steps={steps}
      onFinish={() => {
        setDone(true);
        startTransition(() => {
          void markSeen(tourId);
        });
      }}
    />
  );
}
