"use client";

/**
 * Bell-row relative time — Phase 7 · P7-5
 *
 * Pattern 12: capture `now` ONCE at mount via `useState` lazy initializer
 * so React 19's purity lint doesn't flag `Date.now()`. The dropdown is
 * normally open for seconds, so a stable snapshot per render is fine.
 */

import { useState } from "react";
import { formatNotificationTime } from "@/lib/notification/time-format";

export function RelativeTime({ iso }: { iso: string }) {
  const [now] = useState(() => new Date());
  const created = new Date(iso);
  return <>{formatNotificationTime(created, now)}</>;
}
