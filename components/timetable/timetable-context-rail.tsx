"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  MapPin,
} from "lucide-react";
import { getCourseSlotColors } from "@/lib/theme/course-color";
import {
  formatTimetableDistance,
  getBangkokClock,
  getNextTimetableSlot,
  timeToMinutes,
  TIMETABLE_DAY_LABELS,
  type TimetableDisplaySlot,
  type TimetableRole,
} from "@/lib/timetable/view-model";

export type UnscheduledTimetableCourse = {
  id: string;
  name: string;
  className: string;
  classId: string;
  href: string;
};

export function TimetableContextRail({
  slots,
  role,
  nowIso,
  totalCourseCount,
  unscheduledCourses,
}: {
  slots: TimetableDisplaySlot[];
  role: TimetableRole;
  nowIso: string;
  totalCourseCount: number;
  unscheduledCourses: UnscheduledTimetableCourse[];
}) {
  const [now, setNow] = useState(() => new Date(nowIso));
  const clock = useMemo(() => getBangkokClock(now), [now]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const activeSlot = slots.find(
    (slot) =>
      slot.dayOfWeek === clock.dayOfWeek &&
      timeToMinutes(slot.startTime) <= clock.minutes &&
      clock.minutes < timeToMinutes(slot.endTime)
  );
  const nextSlot = getNextTimetableSlot(slots, clock.dayOfWeek, clock.minutes);
  const focus = activeSlot ?? nextSlot?.slot;
  const scheduledCourseCount = new Set(slots.map((slot) => slot.courseId)).size;
  const occupiedDayCount = new Set(slots.map((slot) => slot.dayOfWeek)).size;
  const allCoursesHref =
    role === "teacher" ? "/teacher/courses" : "/student/courses";

  return (
    <>
      <section className="relative overflow-hidden rounded-2xl border border-blue-500/25 bg-surface p-5 shadow-sm">
        <div className="absolute inset-x-0 top-0 h-1 bg-blue-500" />
        <div className="flex items-start justify-between gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <CalendarClock className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-bg px-2.5 py-1 font-mono text-[11px] font-medium text-ink-mute">
            <Clock3 className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
            {clock.timeLabel}
          </span>
        </div>

        <p className="mt-5 text-xs font-semibold text-blue-700">
          {activeSlot
            ? role === "teacher"
              ? "กำลังสอน"
              : "กำลังเรียน"
            : "คาบถัดไป"}
        </p>
        {focus ? (
          <Link
            href={focus.href}
            className="group mt-1 block rounded-xl transition-colors hover:no-underline"
          >
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate text-lg font-semibold text-ink">
                  {focus.courseName}
                </span>
                <span className="mt-1 block text-sm leading-6 text-ink-mute">
                  วัน{TIMETABLE_DAY_LABELS[focus.dayOfWeek]} · {focus.startTime}
                  –{focus.endTime}
                </span>
              </span>
              <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-blue-700" />
            </span>
            <span className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-mute">
              <span>{focus.className}</span>
              {focus.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {focus.location}
                </span>
              )}
              {!activeSlot && nextSlot && (
                <span className="badge-info">
                  {formatTimetableDistance(nextSlot.distanceMinutes)}
                </span>
              )}
            </span>
          </Link>
        ) : (
          <div className="mt-2 rounded-xl bg-bg p-4">
            <p className="text-sm font-medium text-ink">ยังไม่มีคาบถัดไป</p>
            <p className="mt-1 text-xs leading-5 text-ink-mute">
              ตารางจะอัปเดตทันทีเมื่อมีการกำหนดคาบเรียน
            </p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-hairline bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <CalendarCheck2
            className="h-5 w-5 text-blue-600"
            aria-hidden="true"
          />
          <h2 className="font-semibold text-ink">ภาพรวมสัปดาห์</h2>
        </div>
        <dl className="mt-4 grid grid-cols-3 divide-x divide-hairline rounded-xl bg-bg py-3 text-center">
          <div className="px-2">
            <dt className="text-[11px] text-ink-mute">คาบ</dt>
            <dd className="mt-1 text-xl font-semibold text-ink">
              {slots.length}
            </dd>
          </div>
          <div className="px-2">
            <dt className="text-[11px] text-ink-mute">วิชา</dt>
            <dd className="mt-1 text-xl font-semibold text-ink">
              {scheduledCourseCount}/{totalCourseCount}
            </dd>
          </div>
          <div className="px-2">
            <dt className="text-[11px] text-ink-mute">วัน</dt>
            <dd className="mt-1 text-xl font-semibold text-ink">
              {occupiedDayCount}
            </dd>
          </div>
        </dl>

        <div className="mt-4 border-t border-hairline pt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">
                {role === "teacher" ? "วิชายังไม่มีคาบ" : "วิชาที่รอตาราง"}
              </p>
              <p className="mt-0.5 text-xs text-ink-mute">
                {unscheduledCourses.length > 0
                  ? `${unscheduledCourses.length} วิชายังไม่ปรากฏในตาราง`
                  : "ทุกวิชามีเวลาในตารางแล้ว"}
              </p>
            </div>
            {unscheduledCourses.length === 0 && (
              <CheckCircle2
                className="h-5 w-5 text-green-500"
                aria-hidden="true"
              />
            )}
          </div>

          {unscheduledCourses.length > 0 && (
            <ul className="mt-3 space-y-2">
              {unscheduledCourses.slice(0, 3).map((course) => {
                const colors = getCourseSlotColors(course.classId);
                return (
                  <li key={course.id}>
                    <Link
                      href={course.href}
                      className="flex min-h-11 items-center gap-3 rounded-xl border border-hairline bg-bg px-3 text-sm transition-colors hover:border-blue-500/30 hover:no-underline"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: colors.bg }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink">
                          {course.name}
                        </span>
                        <span className="block truncate text-[11px] text-ink-mute">
                          {course.className}
                        </span>
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <Link
            href={allCoursesHref}
            className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-hairline bg-surface px-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 hover:no-underline"
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            {role === "teacher" ? "จัดการรายวิชา" : "ดูห้องเรียนทั้งหมด"}
          </Link>
        </div>
      </section>
    </>
  );
}
