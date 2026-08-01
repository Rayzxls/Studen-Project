"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CalendarDays, Clock3, X } from "lucide-react";

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

type DateTimeParts = {
  day: string;
  month: string;
  year: string;
  hour: string;
  minute: string;
};

const EMPTY_PARTS: DateTimeParts = {
  day: "",
  month: "",
  year: "",
  hour: "",
  minute: "",
};

type DateTimeFieldProps = {
  name?: string;
  id?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  "aria-label"?: string;
};

/**
 * A locale-explicit replacement for the browser's combined datetime picker.
 * It keeps the existing `YYYY-MM-DDTHH:mm` form contract while presenting
 * labelled Thai date parts, Buddhist years and an unambiguous 24-hour clock.
 */
export function DateTimeField({
  name,
  id,
  value,
  defaultValue,
  onValueChange,
  required = false,
  disabled = false,
  invalid = false,
  className = "",
  "aria-label": ariaLabel = "เลือกวันและเวลา",
}: DateTimeFieldProps) {
  const generatedId = useId().replaceAll(":", "");
  const baseId = id ?? `date-time-${generatedId}`;
  const externalValue = value ?? defaultValue ?? "";
  const [parts, setParts] = useState<DateTimeParts>(() =>
    parseDateTime(externalValue)
  );
  const lastEmittedValue = useRef(externalValue);

  useEffect(() => {
    if (value === undefined || value === lastEmittedValue.current) return;
    lastEmittedValue.current = value;
    setParts(parseDateTime(value));
  }, [value]);

  const yearOptions = useMemo(() => {
    const currentYear = Number(
      new Intl.DateTimeFormat("en", {
        year: "numeric",
        timeZone: "Asia/Bangkok",
      }).format(new Date())
    );
    const selectedYear = Number(parts.year);
    const first = Math.min(
      currentYear - 10,
      Number.isInteger(selectedYear) && selectedYear > 0
        ? selectedYear
        : currentYear
    );
    const last = Math.max(
      currentYear + 15,
      Number.isInteger(selectedYear) && selectedYear > 0
        ? selectedYear
        : currentYear
    );
    return Array.from(
      { length: last - first + 1 },
      (_, index) => first + index
    );
  }, [parts.year]);

  const maximumDay = daysInMonth(parts.month, parts.year);
  const completedValue = combineDateTime(parts);
  const hasAnyValue = Object.values(parts).some(Boolean);
  const isIncomplete = hasAnyValue && !completedValue;
  const partsRequired = required || hasAnyValue;
  const summaryId = `${baseId}-summary`;

  function updateParts(patch: Partial<DateTimeParts>) {
    setParts((current) => {
      const next = { ...current, ...patch };
      const maxDay = daysInMonth(next.month, next.year);
      if (Number(next.day) > maxDay) next.day = pad(maxDay);
      const nextValue = combineDateTime(next);
      lastEmittedValue.current = nextValue;
      onValueChange?.(nextValue);
      return next;
    });
  }

  function clear() {
    setParts(EMPTY_PARTS);
    lastEmittedValue.current = "";
    onValueChange?.("");
  }

  const controlClass =
    "input h-11 cursor-pointer px-3 text-sm disabled:cursor-not-allowed";
  const ariaInvalid = invalid || isIncomplete ? true : undefined;

  return (
    <div className={className}>
      {name && <input type="hidden" name={name} value={completedValue} />}
      <div
        role="group"
        aria-label={ariaLabel}
        aria-describedby={summaryId}
        className={`rounded-2xl border p-3 ${
          ariaInvalid
            ? "border-red-300 bg-red-50/40"
            : "border-hairline bg-black/[0.015]"
        }`}
      >
        <div className="space-y-3">
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-soft">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              วันที่
            </div>
            <div className="grid grid-cols-[0.7fr_1.35fr_0.95fr] gap-2">
              <label className="min-w-0">
                <span className="sr-only">วัน</span>
                <select
                  id={baseId}
                  value={parts.day}
                  onChange={(event) => updateParts({ day: event.target.value })}
                  required={partsRequired}
                  disabled={disabled}
                  aria-invalid={ariaInvalid}
                  className={controlClass}
                >
                  <option value="">วัน</option>
                  {Array.from(
                    { length: maximumDay },
                    (_, index) => index + 1
                  ).map((day) => (
                    <option key={day} value={pad(day)}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0">
                <span className="sr-only">เดือน</span>
                <select
                  id={`${baseId}-month`}
                  value={parts.month}
                  onChange={(event) =>
                    updateParts({ month: event.target.value })
                  }
                  required={partsRequired}
                  disabled={disabled}
                  aria-invalid={ariaInvalid}
                  className={controlClass}
                >
                  <option value="">เดือน</option>
                  {THAI_MONTHS.map((month, index) => (
                    <option key={month} value={pad(index + 1)}>
                      {month}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0">
                <span className="sr-only">ปี</span>
                <select
                  id={`${baseId}-year`}
                  value={parts.year}
                  onChange={(event) =>
                    updateParts({ year: event.target.value })
                  }
                  required={partsRequired}
                  disabled={disabled}
                  aria-invalid={ariaInvalid}
                  className={controlClass}
                >
                  <option value="">ปี</option>
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year + 543}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-soft">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              เวลาแบบ 24 ชั่วโมง
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="min-w-0">
                <span className="sr-only">ชั่วโมง</span>
                <select
                  id={`${baseId}-hour`}
                  value={parts.hour}
                  onChange={(event) =>
                    updateParts({ hour: event.target.value })
                  }
                  required={partsRequired}
                  disabled={disabled}
                  aria-invalid={ariaInvalid}
                  className={controlClass}
                >
                  <option value="">ชั่วโมง</option>
                  {Array.from({ length: 24 }, (_, hour) => (
                    <option key={hour} value={pad(hour)}>
                      {pad(hour)} นาฬิกา
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0">
                <span className="sr-only">นาที</span>
                <select
                  id={`${baseId}-minute`}
                  value={parts.minute}
                  onChange={(event) =>
                    updateParts({ minute: event.target.value })
                  }
                  required={partsRequired}
                  disabled={disabled}
                  aria-invalid={ariaInvalid}
                  className={controlClass}
                >
                  <option value="">นาที</option>
                  {Array.from({ length: 60 }, (_, minute) => (
                    <option key={minute} value={pad(minute)}>
                      {pad(minute)} นาที
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3">
          <p
            id={summaryId}
            className={`text-xs ${isIncomplete ? "text-red-700" : "text-ink-mute"}`}
            aria-live="polite"
          >
            {completedValue
              ? formatThaiSummary(parts)
              : isIncomplete
                ? "กรุณาเลือกวันและเวลาให้ครบ"
                : "ยังไม่ได้ตั้งวันและเวลา"}
          </p>
          {hasAnyValue && !disabled && (
            <button
              type="button"
              onClick={clear}
              className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-lg px-2 text-xs font-medium text-ink-mute transition-colors duration-200 hover:bg-black/[0.04] hover:text-red-700"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              ล้าง
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function parseDateTime(value: string): DateTimeParts {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?/
  );
  if (!match) return { ...EMPTY_PARTS };
  return {
    year: match[1] ?? "",
    month: match[2] ?? "",
    day: match[3] ?? "",
    hour: match[4] ?? "",
    minute: match[5] ?? "",
  };
}

function combineDateTime(parts: DateTimeParts): string {
  if (Object.values(parts).some((part) => !part)) return "";
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function daysInMonth(month: string, year: string): number {
  const parsedMonth = Number(month);
  const parsedYear = Number(year);
  if (!parsedMonth) return 31;
  // Keep 29 February available until the person chooses a year; selecting a
  // non-leap year later clamps the day to the valid maximum.
  const safeYear = parsedYear || 2000;
  return new Date(safeYear, parsedMonth, 0).getDate();
}

function formatThaiSummary(parts: DateTimeParts): string {
  const month = THAI_MONTHS[Number(parts.month) - 1] ?? "";
  return `${Number(parts.day)} ${month} ${Number(parts.year) + 543} เวลา ${parts.hour}:${parts.minute} น.`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
