"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Clock } from "lucide-react";

/**
 * TimePicker — 24-hour, tap-first replacement for the native
 * `<input type="time">` (whose browser UI shows cramped columns and an
 * AM/PM toggle that fights Thai school time).
 *
 * Interaction: a pill trigger shows the current HH:mm; tapping opens a
 * panel with an hour grid (00–23, school hours emphasized) and a
 * 5-minute-step minute grid. Picking a minute closes the panel. A hidden
 * input carries the value so plain form posts keep working; both
 * controlled (value/onChange) and uncontrolled (defaultValue) usages are
 * supported to match the existing forms.
 */

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

/** Typical Thai school day — rendered brighter so the eye lands there. */
const SCHOOL_HOUR_MIN = 7;
const SCHOOL_HOUR_MAX = 17;

const pad = (n: number) => String(n).padStart(2, "0");

function parseHHmm(v: string | undefined): { h: number; m: number } | null {
  if (!v) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(v);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

export function TimePicker({
  name,
  id,
  value,
  defaultValue,
  onChange,
  required,
  ariaLabel,
}: {
  name: string;
  id?: string;
  /** Controlled value ("HH:mm"). Omit to use defaultValue (uncontrolled). */
  value?: string;
  defaultValue?: string;
  onChange?: (next: string) => void;
  required?: boolean;
  ariaLabel?: string;
}) {
  const reactId = useId();
  const triggerId = id ?? `${reactId}-time`;
  const isControlled = value !== undefined;

  const [inner, setInner] = useState(defaultValue ?? "");
  const current = isControlled ? value : inner;
  const parsed = parseHHmm(current);

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  function commit(next: string) {
    if (!isControlled) setInner(next);
    onChange?.(next);
  }

  function pickHour(h: number) {
    commit(`${pad(h)}:${pad(parsed?.m ?? 0)}`);
  }

  function pickMinute(m: number) {
    commit(`${pad(parsed?.h ?? 8)}:${pad(m)}`);
    setOpen(false);
  }

  // Close on outside tap / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const gridBtn =
    "grid h-9 min-w-9 place-items-center rounded-lg text-sm tabular-nums transition-colors";

  return (
    <div ref={rootRef} className="relative" data-testid={`time-picker-${name}`}>
      <input type="hidden" name={name} value={current} required={required} />

      <button
        type="button"
        id={triggerId}
        aria-label={ariaLabel ?? "เลือกเวลา"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className="input flex w-full items-center justify-between gap-2"
      >
        <span
          className={`font-mono text-base tabular-nums ${parsed ? "text-ink" : "text-ink-faint"}`}
        >
          {parsed ? `${pad(parsed.h)}:${pad(parsed.m)}` : "เลือกเวลา"}
        </span>
        <Clock className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="เลือกเวลา"
          className="absolute left-0 top-full z-30 mt-1.5 w-[19rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-hairline bg-surface p-3 shadow-lift"
        >
          <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-mute">
            ชั่วโมง
          </p>
          <div className="mt-1.5 grid grid-cols-6 gap-1">
            {HOURS.map((h) => {
              const selected = parsed?.h === h;
              const school = h >= SCHOOL_HOUR_MIN && h <= SCHOOL_HOUR_MAX;
              return (
                <button
                  key={h}
                  type="button"
                  data-testid={`time-picker-hour-${pad(h)}`}
                  onClick={() => pickHour(h)}
                  aria-pressed={selected}
                  className={`${gridBtn} ${
                    selected
                      ? "bg-blue-600 font-semibold text-white"
                      : school
                        ? "text-ink hover:bg-blue-50"
                        : "text-ink-faint hover:bg-bg"
                  }`}
                >
                  {pad(h)}
                </button>
              );
            })}
          </div>

          <p className="mt-3 px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-mute">
            นาที
          </p>
          <div className="mt-1.5 grid grid-cols-6 gap-1">
            {MINUTES.map((m) => {
              const selected = parsed?.m === m;
              return (
                <button
                  key={m}
                  type="button"
                  data-testid={`time-picker-minute-${pad(m)}`}
                  onClick={() => pickMinute(m)}
                  aria-pressed={selected}
                  className={`${gridBtn} ${
                    selected
                      ? "bg-blue-600 font-semibold text-white"
                      : "text-ink hover:bg-blue-50"
                  }`}
                >
                  {pad(m)}
                </button>
              );
            })}
          </div>

          <p className="mt-2 px-1 text-[11px] text-ink-faint">
            เลือกชั่วโมงก่อน แล้วแตะนาทีเพื่อยืนยัน · เวลาแบบ 24 ชม.
          </p>
        </div>
      )}
    </div>
  );
}
