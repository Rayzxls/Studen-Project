"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Clock } from "lucide-react";

/**
 * TimePicker — 24-hour, tap-first replacement for the native
 * `<input type="time">` (whose browser UI shows cramped columns and an
 * AM/PM toggle that fights Thai school time).
 *
 * Interaction: a pill trigger shows the current HH:mm; tapping opens a
 * panel with an hour grid (00–23) and a
 * 5-minute-step minute grid. Picking a minute closes the panel. A hidden
 * input carries the value so plain form posts keep working; both
 * controlled (value/onChange) and uncontrolled (defaultValue) usages are
 * supported to match the existing forms.
 */

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

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
  disabled = false,
  invalid = false,
  ariaLabel,
}: {
  name?: string;
  id?: string;
  /** Controlled value ("HH:mm"). Omit to use defaultValue (uncontrolled). */
  value?: string;
  defaultValue?: string;
  onChange?: (next: string) => void;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
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
    const preferredMinute = parsed?.m ?? 0;
    commit(`${pad(h)}:${pad(preferredMinute)}`);
  }

  function pickMinute(m: number) {
    const hour = parsed?.h ?? 8;
    commit(`${pad(hour)}:${pad(m)}`);
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
    "grid h-11 min-w-0 place-items-center rounded-lg text-sm tabular-nums transition-colors";

  return (
    <div
      ref={rootRef}
      className="relative"
      data-testid={`time-picker-${name ?? triggerId}`}
    >
      {name && (
        <input type="hidden" name={name} value={current} required={required} />
      )}

      <button
        type="button"
        id={triggerId}
        aria-label={ariaLabel ?? "เลือกเวลา"}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`input flex w-full cursor-pointer items-center justify-between gap-2 transition-colors duration-200 disabled:cursor-not-allowed ${
          invalid ? "border-red-400" : ""
        }`}
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
          className="absolute left-0 top-full z-30 mt-1.5 w-full max-w-xl rounded-2xl border border-hairline bg-surface p-3 shadow-lift"
        >
          <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-mute">
            ชั่วโมง
          </p>
          <div
            data-testid="time-picker-hours"
            className="mt-1.5 grid grid-cols-4 gap-1 sm:grid-cols-6"
          >
            {HOURS.map((h) => {
              const selected = parsed?.h === h;
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
                      : "cursor-pointer text-ink hover:bg-blue-50"
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
          <div
            data-testid="time-picker-minutes"
            className="mt-1.5 grid grid-cols-4 gap-1 sm:grid-cols-6"
          >
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
                      : "cursor-pointer text-ink hover:bg-blue-50"
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
