"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  MapPin,
  PencilLine,
  Plus,
} from "lucide-react";
import {
  TimetableSlotDialog,
  type TimetableCourseOption,
} from "@/components/timetable/timetable-manager";
import {
  TIMETABLE_DAY_LABELS,
  type TimetableDisplaySlot,
} from "@/lib/timetable/view-model";

export type TimetableSlotRow = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location: string | null;
};

type Props = {
  courseId: string;
  courseName: string;
  subjectCode: string | null;
  classId: string;
  className: string;
  slots: TimetableSlotRow[];
};

export function TimetableEditor({
  courseId,
  courseName,
  subjectCode,
  classId,
  className,
  slots,
}: Props) {
  const [dialog, setDialog] = useState<TimetableDisplaySlot | "create" | null>(
    null
  );
  const course: TimetableCourseOption = {
    id: courseId,
    name: courseName,
    subjectCode,
    className,
  };
  const displaySlots: TimetableDisplaySlot[] = slots.map((slot) => ({
    ...slot,
    courseId,
    courseName,
    subjectCode,
    classId,
    className,
    href: `/teacher/courses/${courseId}/settings`,
  }));

  return (
    <section className="rounded-2xl border border-hairline bg-surface p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-ink">ตารางสอน</h3>
            <p className="mt-0.5 max-w-xl text-xs leading-5 text-ink-mute">
              ใช้เป็นเวลาเริ่มต้นเมื่อเปิดคาบ
              การแก้ไขจะไม่เปลี่ยนคาบที่เปิดไปแล้ว
            </p>
            <Link
              href="/teacher/timetable"
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:no-underline"
            >
              ดูตารางสอนทุกวิชา
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={() => setDialog("create")}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          เพิ่มคาบ
        </button>
      </div>

      {displaySlots.length === 0 ? (
        <button
          type="button"
          onClick={() => setDialog("create")}
          className="mt-5 grid min-h-32 w-full place-items-center rounded-xl border border-dashed border-hairline bg-bg p-5 text-center transition-colors hover:border-blue-500/40 hover:bg-blue-50"
        >
          <span>
            <Clock3
              className="mx-auto h-5 w-5 text-ink-faint"
              aria-hidden="true"
            />
            <span className="mt-2 block text-sm font-semibold text-ink">
              ยังไม่มีคาบประจำสัปดาห์
            </span>
            <span className="mt-1 block text-xs text-ink-mute">
              กดเพื่อเพิ่มวัน เวลา และสถานที่ของวิชานี้
            </span>
          </span>
        </button>
      ) : (
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {displaySlots.map((slot) => (
            <li key={slot.id}>
              <button
                type="button"
                onClick={() => setDialog(slot)}
                className="group flex min-h-20 w-full items-center gap-3 rounded-xl border border-hairline bg-bg p-3 text-left transition-all hover:-translate-y-0.5 hover:border-blue-500/30 hover:shadow-sm"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
                  <span className="text-xs font-bold">
                    {TIMETABLE_DAY_LABELS[slot.dayOfWeek].slice(0, 2)}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">
                    วัน{TIMETABLE_DAY_LABELS[slot.dayOfWeek]}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-mute">
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Clock3 className="h-3 w-3" aria-hidden="true" />
                      {slot.startTime}–{slot.endTime}
                    </span>
                    {slot.location && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <MapPin
                          className="h-3 w-3 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="truncate">{slot.location}</span>
                      </span>
                    )}
                  </span>
                </span>
                <PencilLine
                  className="h-4 w-4 shrink-0 text-ink-faint transition-colors group-hover:text-blue-700"
                  aria-hidden="true"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {dialog && (
        <TimetableSlotDialog
          key={dialog === "create" ? "new-course-slot" : dialog.id}
          slot={dialog === "create" ? undefined : dialog}
          courses={[course]}
          existingSlots={displaySlots}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  );
}
