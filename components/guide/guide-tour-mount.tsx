"use client";

import { useState, useTransition } from "react";
import { TeacherSetupGuide } from "./teacher-setup-guide";

/**
 * Bridges the walkthrough to its Server Action. The overlay closes as soon as
 * the teacher finishes or skips, without waiting for the write — the write only
 * decides whether it returns on a later visit, so making them wait for it would
 * be latency with nothing behind it.
 */
export function TeacherSetupGuideMount({
  markSeen,
}: {
  markSeen: () => Promise<void>;
}) {
  const [done, setDone] = useState(false);
  const [, startTransition] = useTransition();

  if (done) return null;

  return (
    <TeacherSetupGuide
      onFinish={() => {
        setDone(true);
        startTransition(() => {
          void markSeen();
        });
      }}
    />
  );
}
