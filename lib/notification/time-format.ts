/**
 * Hybrid relative / absolute time formatter for the bell — Phase 7 · P7-5
 *
 * Pure (no I/O). Takes a UTC Date + a "now" reference and returns a
 * Thai-localised string.
 *
 * Strategy (Q8 lock = C / 7-day hybrid):
 *  - < 60 s  → "ไม่กี่วินาทีที่ผ่านมา"
 *  - < 60 m  → "X นาทีที่ผ่านมา"
 *  - < 24 h  → "X ชม. ที่ผ่านมา"
 *  - < 7 d   → "X วันที่ผ่านมา"
 *  - ≥ 7 d   → absolute Buddhist "8 มิ.ย. 2569" via existing format helper
 *
 * The function accepts `now` as a parameter so callers can pass a
 * stable instant (Pattern 12: capture once at mount via `useState`
 * lazy initializer). Server-render passes `new Date()` once.
 */

import { formatThaiDateShort } from "@/lib/attendance/format";

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

export function formatNotificationTime(createdAt: Date, now: Date): string {
  const deltaMs = now.getTime() - createdAt.getTime();

  // Future timestamps (clock skew) — collapse to "ตอนนี้".
  if (deltaMs < 0) return "ตอนนี้";

  if (deltaMs < MINUTE_MS) return "ไม่กี่วินาทีที่ผ่านมา";

  if (deltaMs < HOUR_MS) {
    const m = Math.floor(deltaMs / MINUTE_MS);
    return `${m} นาทีที่ผ่านมา`;
  }

  if (deltaMs < DAY_MS) {
    const h = Math.floor(deltaMs / HOUR_MS);
    return `${h} ชม. ที่ผ่านมา`;
  }

  if (deltaMs < WEEK_MS) {
    const d = Math.floor(deltaMs / DAY_MS);
    return `${d} วันที่ผ่านมา`;
  }

  return formatThaiDateShort(createdAt);
}
