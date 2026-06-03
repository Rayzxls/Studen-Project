/**
 * Thai + Buddhist-calendar date formatters for the attendance UI — Phase 4.
 *
 * All inputs are UTC Date objects (as stored in Postgres TIMESTAMPTZ).
 * Output is rendered in Asia/Bangkok with Buddhist year via `Intl.DateTimeFormat`
 * (no manual +543 offset, no manual TZ math).
 *
 * Functions are pure — server / client safe.
 */

const TZ = "Asia/Bangkok";
const LOCALE = "th-TH-u-ca-buddhist";

const DOW_LABELS = [
  "อาทิตย์", // 0
  "จันทร์", // 1
  "อังคาร", // 2
  "พุธ", // 3
  "พฤหัสบดี", // 4
  "ศุกร์", // 5
  "เสาร์", // 6
] as const;

const DOW_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."] as const;

export function dayOfWeekLabel(dow: number): string {
  if (!Number.isInteger(dow) || dow < 0 || dow > 6) return "";
  return DOW_LABELS[dow]!;
}

export function dayOfWeekShort(dow: number): string {
  if (!Number.isInteger(dow) || dow < 0 || dow > 6) return "";
  return DOW_SHORT[dow]!;
}

/** "วันจันทร์ที่ 8 มิ.ย. 2569" */
export function formatThaiDate(d: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** "8 มิ.ย. 2569" (compact, no weekday) */
export function formatThaiDateShort(d: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** "13:30" — 24h, Bangkok local. */
export function formatBangkokTime(d: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

/** "13:30–15:00 น." */
export function formatTimeRange(start: Date, end: Date): string {
  return `${formatBangkokTime(start)}–${formatBangkokTime(end)} น.`;
}

/** "วันจันทร์ที่ 8 มิ.ย. 2569 · 13:30–15:00 น." */
export function formatSessionHeader(start: Date, end: Date): string {
  return `${formatThaiDate(start)} · ${formatTimeRange(start, end)}`;
}

/**
 * Parse a "YYYY-MM-DD" string (from `<input type="date">`, treated as a
 * date in Asia/Bangkok) plus a "HH:mm" time string into a UTC Date.
 *
 * Asia/Bangkok is +07:00 fixed (no DST), so the math is direct: take the
 * intended local wall-clock, treat its component fields as if they were
 * UTC, then subtract 7 hours to get the true UTC instant.
 */
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

export function bangkokDateTimeToUtc(dateStr: string, timeStr: string): Date {
  const [yyyy, mm, dd] = dateStr.split("-").map(Number);
  const [hh, mi] = timeStr.split(":").map(Number);
  if (
    !Number.isInteger(yyyy) ||
    !Number.isInteger(mm) ||
    !Number.isInteger(dd) ||
    !Number.isInteger(hh) ||
    !Number.isInteger(mi)
  ) {
    throw new Error("invalid_date_or_time_string");
  }
  const localAsUtcMs = Date.UTC(yyyy, mm - 1, dd, hh, mi, 0, 0);
  return new Date(localAsUtcMs - BANGKOK_OFFSET_MS);
}

/**
 * Day-of-week index (0=Sun..6=Sat) for a `YYYY-MM-DD` string interpreted
 * as a date in Asia/Bangkok. Returns NaN on parse failure.
 */
export function dayOfWeekForDateString(dateStr: string): number {
  const [yyyy, mm, dd] = dateStr.split("-").map(Number);
  if (
    !Number.isInteger(yyyy) ||
    !Number.isInteger(mm) ||
    !Number.isInteger(dd)
  ) {
    return NaN;
  }
  // Construct midnight Bangkok → UTC, then get day in Bangkok via Intl.
  const utc = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0));
  const bkkParts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  }).format(utc);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[bkkParts] ?? NaN;
}

/** Today's date as `YYYY-MM-DD` in Asia/Bangkok. Server-safe. */
export function todayInBangkok(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA already emits YYYY-MM-DD
}
