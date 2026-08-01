"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, Clock3, X } from "lucide-react";

import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";

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

type MinimumDateTime = {
  date: string;
  time: string;
  value: string;
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
  /** Scheduling fields can opt in; historical filters deliberately do not. */
  futureOnly?: boolean;
  className?: string;
  "aria-label"?: string;
};

/**
 * Compact Thai date-time control that keeps the existing
 * `YYYY-MM-DDTHH:mm` form contract. Date and time open separately so the
 * browser never renders the oversized combined picker. Scheduling contexts
 * can exclude the past while audit and reporting filters keep historical use.
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
  futureOnly = false,
  className = "",
  "aria-label": ariaLabel = "เลือกวันและเวลา",
}: DateTimeFieldProps) {
  const generatedId = useId().replaceAll(":", "");
  const baseId = id ?? `date-time-${generatedId}`;
  const externalValue = value ?? defaultValue ?? "";
  const [parts, setParts] = useState<DateTimeParts>(() =>
    parseDateTime(externalValue)
  );
  const [minimum] = useState<MinimumDateTime | null>(() =>
    futureOnly ? getBangkokMinimum() : null
  );
  const lastEmittedValue = useRef(externalValue);

  useEffect(() => {
    if (value === undefined || value === lastEmittedValue.current) return;
    lastEmittedValue.current = value;
    setParts(parseDateTime(value));
  }, [value]);

  const completedValue = combineDateTime(parts);
  const selectedDate = combineDate(parts);
  const selectedTime = combineTime(parts);
  const hasAnyValue = Object.values(parts).some(Boolean);
  const isIncomplete = hasAnyValue && !completedValue;
  const isPast = Boolean(
    futureOnly && minimum && completedValue && completedValue < minimum.value
  );
  const partsRequired = required || hasAnyValue;
  const ariaInvalid = invalid || isIncomplete || isPast ? true : undefined;
  const summaryId = `${baseId}-summary`;
  const timeMinimum =
    futureOnly && minimum && selectedDate === minimum.date
      ? minimum.time
      : undefined;

  function updateParts(patch: Partial<DateTimeParts>) {
    setParts((current) => {
      const next = { ...current, ...patch };
      const nextValue = combineDateTime(next);
      lastEmittedValue.current = nextValue;
      onValueChange?.(nextValue);
      return next;
    });
  }

  function updateDate(date: string) {
    if (!date) {
      updateParts({ day: "", month: "", year: "" });
      return;
    }

    const [year = "", month = "", day = ""] = date.split("-");
    const patch: Partial<DateTimeParts> = { year, month, day };
    if (
      futureOnly &&
      minimum &&
      selectedTime &&
      `${date}T${selectedTime}` < minimum.value &&
      date === minimum.date
    ) {
      const [hour = "", minute = ""] = minimum.time.split(":");
      patch.hour = hour;
      patch.minute = minute;
    }
    updateParts(patch);
  }

  function updateTime(time: string) {
    const [hour = "", minute = ""] = time.split(":");
    updateParts({ hour, minute });
  }

  function clear() {
    setParts(EMPTY_PARTS);
    lastEmittedValue.current = "";
    onValueChange?.("");
  }

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
            : "border-hairline bg-surface"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            วันและเวลา
          </div>
          {futureOnly && (
            <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700">
              ตั้งแต่ปัจจุบัน
            </span>
          )}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label
              htmlFor={baseId}
              className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-soft"
            >
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              วันที่
            </label>
            <DatePicker
              id={baseId}
              value={selectedDate}
              min={futureOnly ? minimum?.date : undefined}
              onChange={updateDate}
              disabled={disabled}
              invalid={ariaInvalid}
            />
          </div>

          <div className="min-w-0">
            <label
              htmlFor={`${baseId}-time`}
              className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-soft"
            >
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              เวลา (24 ชม.)
            </label>
            <TimePicker
              id={`${baseId}-time`}
              value={selectedTime}
              onChange={updateTime}
              required={partsRequired}
              disabled={disabled}
              invalid={ariaInvalid}
              min={timeMinimum}
              ariaLabel="เวลา"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3">
          <p
            id={summaryId}
            className={`text-xs ${
              isIncomplete || isPast ? "text-red-700" : "text-ink-mute"
            }`}
            aria-live="polite"
          >
            {isPast
              ? "กรุณาเลือกเวลาปัจจุบันหรืออนาคต"
              : completedValue
                ? formatThaiSummary(parts)
                : isIncomplete
                  ? "กรุณาเลือกวันและเวลาให้ครบ"
                  : "ยังไม่ได้ตั้งวันและเวลา"}
          </p>
          {hasAnyValue && !disabled && (
            <button
              type="button"
              onClick={clear}
              className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-lg px-2 text-xs font-medium text-ink-mute transition-colors duration-200 hover:bg-bg hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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

function combineDate(parts: DateTimeParts): string {
  if (!parts.year || !parts.month || !parts.day) return "";
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function combineTime(parts: DateTimeParts): string {
  if (!parts.hour || !parts.minute) return "";
  return `${parts.hour}:${parts.minute}`;
}

function combineDateTime(parts: DateTimeParts): string {
  const date = combineDate(parts);
  const time = combineTime(parts);
  return date && time ? `${date}T${time}` : "";
}

function formatThaiSummary(parts: DateTimeParts): string {
  const month = THAI_MONTHS[Number(parts.month) - 1] ?? "";
  return `${Number(parts.day)} ${month} ${Number(parts.year) + 543} เวลา ${parts.hour}:${parts.minute} น.`;
}

function getBangkokClock(): { date: string; hour: number; minute: number } {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function getBangkokMinimum(): MinimumDateTime {
  const now = getBangkokClock();
  const nextFiveMinutes = Math.ceil((now.hour * 60 + now.minute + 1) / 5) * 5;
  const rollsToTomorrow = nextFiveMinutes >= 24 * 60;
  const totalMinutes = rollsToTomorrow ? 0 : nextFiveMinutes;
  const date = rollsToTomorrow ? addDays(now.date, 1) : now.date;
  const time = `${pad(Math.floor(totalMinutes / 60))}:${pad(totalMinutes % 60)}`;
  return { date, time, value: `${date}T${time}` };
}

function addDays(date: string, days: number): string {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
