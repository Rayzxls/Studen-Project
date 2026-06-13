"use client";

/**
 * Bell-row relative time — Phase 7 · P7-5
 *
 * Pattern 12: capture `now` ONCE at mount via `useState` lazy initializer
 * so React 19's purity lint doesn't flag `Date.now()`. The dropdown is
 * normally open for seconds, so a stable snapshot per render is fine.
 */

import { useSyncExternalStore } from "react";
import { formatNotificationTime } from "@/lib/notification/time-format";

let currentNowMs = 0;
const listeners = new Set<() => void>();

function emitNow() {
  currentNowMs = Date.now();
  listeners.forEach((listener) => listener());
}

function subscribeNow(listener: () => void): () => void {
  listeners.add(listener);

  const timeoutId = window.setTimeout(emitNow, 0);
  const intervalId = window.setInterval(emitNow, 60_000);

  return () => {
    listeners.delete(listener);
    window.clearTimeout(timeoutId);
    window.clearInterval(intervalId);
  };
}

function getNowSnapshot() {
  return currentNowMs;
}

function getServerNowSnapshot() {
  return 0;
}

export function RelativeTime({ iso }: { iso: string }) {
  const nowMs = useSyncExternalStore(
    subscribeNow,
    getNowSnapshot,
    getServerNowSnapshot
  );
  const created = new Date(iso);

  return (
    <time dateTime={iso}>
      {nowMs > 0 ? formatNotificationTime(created, new Date(nowMs)) : ""}
    </time>
  );
}
