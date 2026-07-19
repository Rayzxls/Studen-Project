"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  CalendarClock,
  ChevronRight,
  Clock3,
  MapPin,
  Plus,
  Settings2,
} from "lucide-react";
import { getCourseSlotColors } from "@/lib/theme/course-color";
import {
  getNextTimetableSlot,
  minutesToTime,
  positionDaySlots,
  suggestTimetableSlot,
  timetableBounds,
  timeToMinutes,
  TIMETABLE_DAY_LABELS,
  TIMETABLE_DAY_SHORT_LABELS,
  visibleTimetableDays,
  type TimetableDisplaySlot,
  type TimetableRole,
} from "@/lib/timetable/view-model";

const HOUR_WIDTH = 124;
const DAY_COLUMN_WIDTH = 112;
const LANE_HEIGHT = 70;
const ROW_PADDING = 10;

type Props = {
  slots: TimetableDisplaySlot[];
  role: TimetableRole;
  nowIso: string;
  onSlotSelect?: (slot: TimetableDisplaySlot) => void;
  onEmptyCellSelect?: (selection: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }) => void;
};

type BangkokClock = {
  dayOfWeek: number;
  minutes: number;
  timeLabel: string;
};

export function WeeklyTimetable({
  slots,
  role,
  nowIso,
  onSlotSelect,
  onEmptyCellSelect,
}: Props) {
  const [now, setNow] = useState(() => new Date(nowIso));
  const days = useMemo(() => visibleTimetableDays(slots), [slots]);
  const clock = useMemo(() => getBangkokClock(now), [now]);
  const [selectedDay, setSelectedDay] = useState(() =>
    days.includes(clock.dayOfWeek) ? clock.dayOfWeek : (days[0] ?? 1)
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<number, TimetableDisplaySlot[]>();
    for (const day of days) map.set(day, []);
    for (const slot of slots) {
      const rows = map.get(slot.dayOfWeek) ?? [];
      rows.push(slot);
      map.set(slot.dayOfWeek, rows);
    }
    for (const rows of map.values()) {
      rows.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [days, slots]);

  const activeSlot = slots.find(
    (slot) =>
      slot.dayOfWeek === clock.dayOfWeek &&
      timeToMinutes(slot.startTime) <= clock.minutes &&
      clock.minutes < timeToMinutes(slot.endTime)
  );
  const nextSlot = getNextTimetableSlot(slots, clock.dayOfWeek, clock.minutes);

  return (
    <div className="space-y-4">
      <ScheduleBrief
        activeSlot={activeSlot}
        nextSlot={nextSlot}
        clock={clock}
        role={role}
      />

      <DesktopTimetable
        slots={slots}
        days={days}
        byDay={byDay}
        clock={clock}
        role={role}
        onSlotSelect={onSlotSelect}
        onEmptyCellSelect={onEmptyCellSelect}
      />
      <MobileTimetable
        days={days}
        byDay={byDay}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        clock={clock}
        role={role}
        onSlotSelect={onSlotSelect}
        onEmptyCellSelect={onEmptyCellSelect}
      />
    </div>
  );
}

function ScheduleBrief({
  activeSlot,
  nextSlot,
  clock,
  role,
}: {
  activeSlot?: TimetableDisplaySlot;
  nextSlot: ReturnType<typeof getNextTimetableSlot>;
  clock: BangkokClock;
  role: TimetableRole;
}) {
  const focus = activeSlot ?? nextSlot?.slot;
  return (
    <section className="flex min-h-24 flex-col justify-between gap-4 rounded-2xl border border-hairline bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
          <CalendarClock className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-blue-700">
            {activeSlot
              ? role === "teacher"
                ? "กำลังสอน"
                : "กำลังเรียน"
              : "คาบถัดไป"}
          </p>
          {focus ? (
            <>
              <p className="mt-0.5 truncate text-base font-semibold text-ink">
                {focus.courseName}
              </p>
              <p className="mt-0.5 truncate text-xs text-ink-mute">
                วัน{TIMETABLE_DAY_LABELS[focus.dayOfWeek]} · {focus.startTime}–
                {focus.endTime} · {focus.className}
                {!activeSlot && nextSlot
                  ? ` · ${formatDistance(nextSlot.distanceMinutes)}`
                  : ""}
              </p>
            </>
          ) : (
            <p className="mt-0.5 text-sm font-medium text-ink-mute">
              ยังไม่มีคาบในตารางประจำสัปดาห์
            </p>
          )}
        </div>
      </div>
      <div className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-bg px-3 py-2 text-xs font-medium text-ink-mute sm:self-auto">
        <Clock3 className="h-4 w-4 text-blue-600" aria-hidden="true" />
        กรุงเทพฯ {clock.timeLabel} น.
      </div>
    </section>
  );
}

function DesktopTimetable({
  slots,
  days,
  byDay,
  clock,
  role,
  onSlotSelect,
  onEmptyCellSelect,
}: {
  slots: TimetableDisplaySlot[];
  days: number[];
  byDay: Map<number, TimetableDisplaySlot[]>;
  clock: BangkokClock;
  role: TimetableRole;
  onSlotSelect?: (slot: TimetableDisplaySlot) => void;
  onEmptyCellSelect?: Props["onEmptyCellSelect"];
}) {
  const bounds = timetableBounds(slots);
  const hours = Array.from(
    { length: Math.ceil((bounds.endMinutes - bounds.startMinutes) / 60) },
    (_, index) => bounds.startMinutes + index * 60
  );
  const timelineWidth = hours.length * HOUR_WIDTH;
  const gridWidth = DAY_COLUMN_WIDTH + timelineWidth;

  return (
    <div className="hidden overflow-hidden rounded-2xl border border-hairline bg-surface shadow-sm md:block">
      <div className="overflow-x-auto">
        <div style={{ width: gridWidth, minWidth: "100%" }}>
          <div className="sticky top-0 z-20 flex border-b border-hairline bg-surface">
            <div
              className="sticky left-0 z-30 flex shrink-0 items-center border-r border-hairline bg-surface px-4 text-xs font-semibold text-ink-mute"
              style={{ width: DAY_COLUMN_WIDTH, height: 58 }}
            >
              วัน / เวลา
            </div>
            <div className="relative shrink-0" style={{ width: timelineWidth }}>
              {hours.map((minute, index) => (
                <div
                  key={minute}
                  className="absolute inset-y-0 flex items-center border-r border-hairline px-3 font-mono text-xs text-ink-mute"
                  style={{ left: index * HOUR_WIDTH, width: HOUR_WIDTH }}
                >
                  {minutesToTime(minute)}
                </div>
              ))}
            </div>
          </div>

          {days.map((day) => {
            const positioned = positionDaySlots(byDay.get(day) ?? []);
            const rowHeight = Math.max(
              78,
              positioned.laneCount * LANE_HEIGHT + ROW_PADDING * 2
            );
            const isToday = day === clock.dayOfWeek;
            const nowLeft =
              ((clock.minutes - bounds.startMinutes) / 60) * HOUR_WIDTH;
            const showNow =
              isToday &&
              clock.minutes >= bounds.startMinutes &&
              clock.minutes <= bounds.endMinutes;

            return (
              <div
                key={day}
                className="flex border-b border-hairline last:border-b-0"
                style={{ height: rowHeight }}
              >
                <div
                  className={`sticky left-0 z-10 flex shrink-0 flex-col justify-center border-r border-hairline px-4 ${
                    isToday ? "bg-blue-50" : "bg-surface"
                  }`}
                  style={{ width: DAY_COLUMN_WIDTH }}
                >
                  <span className="text-sm font-semibold text-ink">
                    {TIMETABLE_DAY_LABELS[day]}
                  </span>
                  <span className="mt-1 text-[11px] text-ink-mute">
                    {positioned.slots.length > 0
                      ? `${positioned.slots.length} คาบ`
                      : "ว่าง"}
                  </span>
                </div>

                <div
                  className={`relative shrink-0 ${onEmptyCellSelect ? "cursor-crosshair" : ""}`}
                  style={{ width: timelineWidth }}
                  onClick={(event) => {
                    if (!onEmptyCellSelect) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    const offsetX = Math.max(
                      0,
                      Math.min(rect.width, event.clientX - rect.left)
                    );
                    const rawMinutes =
                      bounds.startMinutes + (offsetX / HOUR_WIDTH) * 60;
                    const startMinutes = Math.min(
                      23 * 60,
                      Math.floor(rawMinutes / 15) * 15
                    );
                    const endMinutes = Math.min(
                      23 * 60 + 55,
                      startMinutes + 60
                    );
                    onEmptyCellSelect({
                      dayOfWeek: day,
                      startTime: minutesToTime(startMinutes),
                      endTime: minutesToTime(endMinutes),
                    });
                  }}
                >
                  {hours.map((minute, index) => (
                    <div
                      key={minute}
                      aria-hidden="true"
                      className="absolute inset-y-0 border-r border-hairline"
                      style={{ left: index * HOUR_WIDTH, width: HOUR_WIDTH }}
                    />
                  ))}

                  {positioned.slots.length === 0 && (
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-ink-faint">
                      ไม่มีคาบเรียน
                    </span>
                  )}

                  {positioned.slots.map((slot) => {
                    const left =
                      ((slot.startMinutes - bounds.startMinutes) / 60) *
                      HOUR_WIDTH;
                    const width = Math.max(
                      52,
                      ((slot.endMinutes - slot.startMinutes) / 60) *
                        HOUR_WIDTH -
                        8
                    );
                    return (
                      <ScheduleBlock
                        key={slot.id}
                        slot={slot}
                        role={role}
                        onSelect={onSlotSelect}
                        compact={width < 120}
                        style={{
                          left: left + 4,
                          top: ROW_PADDING + slot.lane * LANE_HEIGHT,
                          width,
                          height: LANE_HEIGHT - 8,
                        }}
                      />
                    );
                  })}

                  {showNow && (
                    <div
                      aria-label={`เวลาปัจจุบัน ${clock.timeLabel} น.`}
                      className="pointer-events-none absolute inset-y-0 z-20 w-px bg-blue-600"
                      style={{ left: nowLeft }}
                    >
                      <span className="absolute -left-1 top-2 h-2 w-2 rounded-full bg-blue-600 shadow-[0_0_0_4px_rgba(10,132,255,0.15)]" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ScheduleBlock({
  slot,
  role,
  compact,
  style,
  onSelect,
}: {
  slot: TimetableDisplaySlot;
  role: TimetableRole;
  compact: boolean;
  style: CSSProperties;
  onSelect?: (slot: TimetableDisplaySlot) => void;
}) {
  const colors = getCourseSlotColors(slot.classId);
  return (
    <Link
      href={slot.href}
      data-testid="timetable-slot"
      data-view="desktop"
      data-course-id={slot.courseId}
      onClick={(event) => {
        if (!onSelect) return;
        event.stopPropagation();
        event.preventDefault();
        onSelect(slot);
      }}
      aria-haspopup={onSelect ? "dialog" : undefined}
      aria-label={`${slot.courseName} ${slot.startTime} ถึง ${slot.endTime}`}
      title={`${slot.courseName}\n${slot.className}\n${slot.startTime}–${slot.endTime}${slot.location ? `\n${slot.location}` : ""}`}
      className="group absolute z-10 overflow-hidden rounded-xl border px-3 py-2 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:no-underline hover:shadow-md focus-visible:z-30"
      style={{
        ...style,
        borderColor: colors.bg,
        background: `color-mix(in srgb, ${colors.bg} 16%, var(--color-surface))`,
      }}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <span className="truncate text-xs font-semibold text-ink">
          {slot.subjectCode || slot.courseName}
        </span>
        {role === "teacher" && !compact && (
          <Settings2
            className="h-3.5 w-3.5 shrink-0 text-ink-mute transition-transform group-hover:rotate-45"
            aria-hidden="true"
          />
        )}
      </div>
      {!compact && (
        <>
          <p className="mt-1 truncate text-[11px] text-ink-mute">
            {slot.className}
            {slot.location ? ` · ${slot.location}` : ""}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-ink-mute">
            {slot.startTime}–{slot.endTime}
          </p>
        </>
      )}
    </Link>
  );
}

function MobileTimetable({
  days,
  byDay,
  selectedDay,
  onSelectDay,
  clock,
  role,
  onSlotSelect,
  onEmptyCellSelect,
}: {
  days: number[];
  byDay: Map<number, TimetableDisplaySlot[]>;
  selectedDay: number;
  onSelectDay: (day: number) => void;
  clock: BangkokClock;
  role: TimetableRole;
  onSlotSelect?: (slot: TimetableDisplaySlot) => void;
  onEmptyCellSelect?: Props["onEmptyCellSelect"];
}) {
  const rows = byDay.get(selectedDay) ?? [];
  const suggestedSlot = suggestTimetableSlot(rows, selectedDay);
  return (
    <div className="md:hidden">
      <div
        className="flex gap-2 overflow-x-auto pb-2"
        role="tablist"
        aria-label="เลือกวัน"
      >
        {days.map((day) => {
          const active = selectedDay === day;
          const count = byDay.get(day)?.length ?? 0;
          return (
            <button
              key={day}
              type="button"
              role="tab"
              data-testid="timetable-day-tab"
              data-day={day}
              aria-selected={active}
              onClick={() => onSelectDay(day)}
              className={`flex h-11 min-w-[66px] shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition-colors ${
                active
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-hairline bg-surface text-ink-mute"
              }`}
            >
              {TIMETABLE_DAY_SHORT_LABELS[day]}
              {count > 0 && (
                <span
                  className={`text-[10px] ${active ? "text-white/75" : "text-ink-faint"}`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <section className="mt-2 overflow-hidden rounded-2xl border border-hairline bg-surface p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-ink-mute">ตารางประจำวัน</p>
            <h2 className="mt-0.5 text-lg font-semibold text-ink">
              วัน{TIMETABLE_DAY_LABELS[selectedDay]}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge">
              {rows.length > 0 ? `${rows.length} คาบ` : "ไม่มีคาบ"}
            </span>
            {onEmptyCellSelect && (
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => onEmptyCellSelect(suggestedSlot)}
                aria-label={`เพิ่มคาบวัน${TIMETABLE_DAY_LABELS[selectedDay]}`}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                เพิ่มคาบ
              </button>
            )}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="mt-4 grid min-h-36 place-items-center rounded-xl border border-dashed border-hairline bg-bg text-center">
            <div>
              <CalendarClock className="mx-auto h-6 w-6 text-ink-faint" />
              <p className="mt-2 text-sm font-medium text-ink-mute">
                วันนี้ไม่มีคาบเรียน
              </p>
            </div>
          </div>
        ) : (
          <ol className="relative mt-5 space-y-3 before:absolute before:bottom-5 before:left-[4.2rem] before:top-5 before:w-px before:bg-hairline">
            {rows.map((slot) => {
              const isLive =
                selectedDay === clock.dayOfWeek &&
                timeToMinutes(slot.startTime) <= clock.minutes &&
                clock.minutes < timeToMinutes(slot.endTime);
              const colors = getCourseSlotColors(slot.classId);
              return (
                <li
                  key={slot.id}
                  className="relative grid grid-cols-[3.4rem_1fr] gap-5"
                >
                  <div className="pt-3 text-right font-mono text-xs font-semibold text-ink-mute">
                    {slot.startTime}
                  </div>
                  <span
                    aria-hidden="true"
                    className="absolute left-[3.91rem] top-4 z-10 h-2.5 w-2.5 rounded-full ring-4 ring-surface"
                    style={{ background: colors.bg }}
                  />
                  <Link
                    href={slot.href}
                    data-testid="timetable-slot"
                    data-view="mobile"
                    data-course-id={slot.courseId}
                    onClick={(event) => {
                      if (!onSlotSelect) return;
                      event.preventDefault();
                      onSlotSelect(slot);
                    }}
                    aria-haspopup={onSlotSelect ? "dialog" : undefined}
                    className="group min-w-0 rounded-xl border p-3 transition-all hover:-translate-y-0.5 hover:no-underline hover:shadow-sm"
                    style={{
                      borderColor: isLive ? colors.bg : "var(--color-hairline)",
                      background: `color-mix(in srgb, ${colors.bg} ${isLive ? 18 : 10}%, var(--color-surface))`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">
                          {slot.courseName}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-ink-mute">
                          {slot.className} · {slot.startTime}–{slot.endTime}
                        </p>
                      </div>
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {isLive && (
                        <span className="badge-info">
                          {role === "teacher" ? "กำลังสอน" : "กำลังเรียน"}
                        </span>
                      )}
                      {slot.location && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-ink-mute">
                          <MapPin className="h-3 w-3" aria-hidden="true" />
                          {slot.location}
                        </span>
                      )}
                      {role === "teacher" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700">
                          <Settings2 className="h-3 w-3" aria-hidden="true" />
                          จัดการคาบ
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

function getBangkokClock(date: Date): BangkokClock {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const hours = Number(values.hour ?? 0);
  const minutes = Number(values.minute ?? 0);
  return {
    dayOfWeek: dayMap[values.weekday ?? "Mon"] ?? 1,
    minutes: hours * 60 + minutes,
    timeLabel: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
  };
}

function formatDistance(distanceMinutes: number): string {
  if (distanceMinutes < 60) return `อีก ${distanceMinutes} นาที`;
  if (distanceMinutes < 24 * 60) {
    const hours = Math.floor(distanceMinutes / 60);
    const minutes = distanceMinutes % 60;
    return minutes > 0
      ? `อีก ${hours} ชม. ${minutes} นาที`
      : `อีก ${hours} ชม.`;
  }
  const days = Math.floor(distanceMinutes / (24 * 60));
  return days === 1 ? "พรุ่งนี้" : `อีก ${days} วัน`;
}
