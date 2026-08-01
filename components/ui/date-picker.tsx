"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
] as const;

const THAI_MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
] as const;

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"] as const;

type MonthView = { year: number; month: number };

export function DatePicker({
  id,
  value,
  onChange,
  min,
  disabled = false,
  invalid = false,
  ariaLabel = "วันที่",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  disabled?: boolean;
  invalid?: boolean;
  ariaLabel?: string;
}) {
  const generatedId = useId().replaceAll(":", "");
  const triggerId = id ?? `date-picker-${generatedId}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<MonthView>(() =>
    monthFromDate(value || min || bangkokToday())
  );

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
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

  function toggle() {
    if (!open) setView(monthFromDate(value || min || bangkokToday()));
    setOpen((current) => !current);
  }

  function shiftMonth(offset: number) {
    setView((current) => {
      const shifted = new Date(
        Date.UTC(current.year, current.month - 1 + offset, 1)
      );
      return {
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth() + 1,
      };
    });
  }

  function choose(date: string) {
    if (min && date < min) return;
    onChange(date);
    setOpen(false);
  }

  const days = calendarCells(view);
  const today = bangkokToday();
  const previousMonth = shiftMonthValue(view, -1);
  const previousDisabled = Boolean(min && lastDateOfMonth(previousMonth) < min);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={triggerId}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={toggle}
        className={`input flex h-11 w-full cursor-pointer items-center justify-between gap-2 px-3 text-left transition-colors duration-200 disabled:cursor-not-allowed ${
          invalid ? "border-red-400" : ""
        }`}
      >
        <span className={value ? "text-ink" : "text-ink-faint"}>
          {value ? formatCompactDate(value) : "เลือกวันที่"}
        </span>
        <CalendarDays className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="ปฏิทินเลือกวันที่"
          className="absolute left-0 top-full z-40 mt-1.5 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-hairline bg-surface p-3 shadow-lift"
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              disabled={previousDisabled}
              aria-label="เดือนก่อนหน้า"
              className="grid h-11 w-11 cursor-pointer place-items-center rounded-xl text-ink-soft transition-colors duration-200 hover:bg-bg hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold text-ink">
                {THAI_MONTHS[view.month - 1]} {view.year + 543}
              </p>
              <p className="text-[11px] text-ink-faint">เวลาไทย</p>
            </div>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="เดือนถัดไป"
              className="grid h-11 w-11 cursor-pointer place-items-center rounded-xl text-ink-soft transition-colors duration-200 hover:bg-bg hover:text-ink"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1" aria-hidden>
            {WEEKDAYS.map((weekday, index) => (
              <span
                key={weekday}
                className={`grid h-8 place-items-center text-[11px] font-medium ${
                  index === 0 || index === 6
                    ? "text-blue-600"
                    : "text-ink-faint"
                }`}
              >
                {weekday}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((date, index) => {
              if (!date || (min && date < min)) {
                return <span key={`blank-${index}`} className="h-11" />;
              }

              const selected = value === date;
              const isToday = today === date;
              const day = Number(date.slice(-2));
              const weekday = index % 7;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => choose(date)}
                  aria-label={formatLongDate(date)}
                  aria-pressed={selected}
                  aria-current={isToday ? "date" : undefined}
                  className={`relative grid h-11 min-w-0 cursor-pointer place-items-center rounded-xl text-sm tabular-nums transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    selected
                      ? "bg-blue-600 font-semibold text-white"
                      : isToday
                        ? "border border-blue-300 bg-blue-50 font-semibold text-blue-700"
                        : weekday === 0 || weekday === 6
                          ? "text-blue-700 hover:bg-blue-50"
                          : "text-ink hover:bg-bg"
                  }`}
                >
                  {day}
                  {isToday && !selected && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-blue-500" />
                  )}
                </button>
              );
            })}
          </div>

          {min && (
            <div className="mt-3 flex items-center gap-1.5 border-t border-hairline pt-3">
              {[
                { label: "วันนี้", date: today },
                { label: "พรุ่งนี้", date: addDays(today, 1) },
                { label: "+7 วัน", date: addDays(today, 7) },
              ].map((shortcut) => (
                <button
                  key={shortcut.label}
                  type="button"
                  onClick={() => choose(shortcut.date)}
                  disabled={shortcut.date < min}
                  className="min-h-9 flex-1 cursor-pointer rounded-lg border border-hairline bg-bg px-2 text-xs font-medium text-ink-soft transition-colors duration-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {shortcut.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function calendarCells(view: MonthView): Array<string | null> {
  const firstWeekday = new Date(
    Date.UTC(view.year, view.month - 1, 1)
  ).getUTCDay();
  const daysInMonth = new Date(Date.UTC(view.year, view.month, 0)).getUTCDate();
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  return Array.from({ length: cellCount }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth
      ? `${view.year}-${pad(view.month)}-${pad(day)}`
      : null;
  });
}

function monthFromDate(date: string): MonthView {
  const [year = 0, month = 1] = date.split("-").map(Number);
  return { year, month };
}

function shiftMonthValue(view: MonthView, offset: number): MonthView {
  const shifted = new Date(Date.UTC(view.year, view.month - 1 + offset, 1));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
  };
}

function lastDateOfMonth(view: MonthView): string {
  const day = new Date(Date.UTC(view.year, view.month, 0)).getUTCDate();
  return `${view.year}-${pad(view.month)}-${pad(day)}`;
}

function formatCompactDate(date: string): string {
  const [year = 0, month = 1, day = 0] = date.split("-").map(Number);
  return `${day} ${THAI_MONTHS_SHORT[month - 1]} ${year + 543}`;
}

function formatLongDate(date: string): string {
  const [year = 0, month = 1, day = 0] = date.split("-").map(Number);
  return `เลือก ${day} ${THAI_MONTHS[month - 1]} ${year + 543}`;
}

function bangkokToday(): string {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date: string, days: number): string {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
