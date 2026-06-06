"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { X, Plus } from "lucide-react";
import {
  createSessionAction,
  type CreateSessionState,
} from "@/app/teacher/courses/[id]/attendance/actions";
import {
  dayOfWeekForDateString,
  dayOfWeekLabel,
  formatThaiDate,
  bangkokDateTimeToUtc,
} from "@/lib/attendance/format";

const INITIAL_STATE: CreateSessionState = {};

export type TimetableSlotOption = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location: string | null;
};

type Props = {
  courseId: string;
  slots: TimetableSlotOption[];
  defaultDate: string; // "YYYY-MM-DD" — today in Asia/Bangkok, server-rendered
};

const MANUAL = "manual" as const;

export function CreateSessionForm({ courseId, slots, defaultDate }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const initialDow = dayOfWeekForDateString(defaultDate);
  const initialMatching = slots.filter((s) => s.dayOfWeek === initialDow);
  const initialSlot = initialMatching[0];

  const [dateStr, setDateStr] = useState(defaultDate);
  const [slotId, setSlotId] = useState<string>(initialSlot?.id ?? MANUAL);
  const [startTime, setStartTime] = useState(initialSlot?.startTime ?? "13:00");
  const [endTime, setEndTime] = useState(initialSlot?.endTime ?? "14:00");
  const [note, setNote] = useState("");

  const dow = useMemo(() => dayOfWeekForDateString(dateStr), [dateStr]);
  const matchingSlots = useMemo(
    () => slots.filter((s) => s.dayOfWeek === dow),
    [slots, dow]
  );

  const [state, formAction] = useActionState(
    createSessionAction,
    INITIAL_STATE
  );

  // Server Action redirects to the grid page on success → this component
  // unmounts. There is no "ok" state to act on. fieldErrors / error
  // surface inline. (Pattern 9: avoid setState-in-effect.)
  useEffect(() => {
    // intentionally empty — kept as a marker to remind future readers
    // that this dialog has no ok-state effect (success = navigation).
  }, []);

  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();

  const onDateChange = (newDate: string) => {
    setDateStr(newDate);
    const newDow = dayOfWeekForDateString(newDate);
    const newMatching = slots.filter((s) => s.dayOfWeek === newDow);
    if (slotId !== MANUAL && !newMatching.find((s) => s.id === slotId)) {
      const first = newMatching[0];
      if (first) {
        setSlotId(first.id);
        setStartTime(first.startTime);
        setEndTime(first.endTime);
      } else {
        setSlotId(MANUAL);
      }
    }
  };

  const onSlotChange = (newId: string) => {
    setSlotId(newId);
    if (newId !== MANUAL) {
      const slot = slots.find((s) => s.id === newId);
      if (slot) {
        setStartTime(slot.startTime);
        setEndTime(slot.endTime);
      }
    }
  };

  const timeInvalid = startTime >= endTime;

  // Show conflict warning if a Session already exists at this start.
  // We don't query — the server action will return Conflict via the lib's
  // unique constraint; here we just surface a friendly hint via parsed
  // datetime + the existing flag (not implemented in v1; left for v2).
  const dateLabel = useMemo(() => {
    try {
      const utc = bangkokDateTimeToUtc(dateStr, "00:00");
      return formatThaiDate(utc);
    } catch {
      return "";
    }
  }, [dateStr]);

  return (
    <>
      <button type="button" onClick={open} className="btn-primary btn-sm">
        <Plus className="mr-1 inline h-4 w-4" />
        เปิดคาบ
      </button>

      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-white p-0 shadow-lift backdrop:bg-black/40 backdrop:backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
      >
        <form action={formAction} className="p-6">
          <input type="hidden" name="courseId" value={courseId} />

          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2
                className="text-lg font-medium text-black"
                style={{ letterSpacing: "-0.02em" }}
              >
                เปิดคาบเรียนใหม่
              </h2>
              <p className="mt-1 text-sm text-black/60">
                เลือกวันที่และเวลา จะใช้ตารางที่ตั้งไว้หรือระบุเองก็ได้
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="ปิด"
              className="rounded-full p-1 text-black/40 transition-colors hover:bg-black/[0.05] hover:text-black"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="date"
                className="mb-1.5 block text-xs font-medium text-black/60"
              >
                วันที่
              </label>
              <input
                type="date"
                id="date"
                name="date"
                required
                value={dateStr}
                onChange={(e) => onDateChange(e.target.value)}
                className="input"
              />
              {dateLabel && (
                <p className="mt-1 text-xs text-black/50">
                  {dateLabel} (วัน{dayOfWeekLabel(dow)})
                </p>
              )}
              {state.fieldErrors?.date && (
                <p className="mt-1 text-xs text-red-700">
                  {state.fieldErrors.date}
                </p>
              )}
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-medium text-black/60">
                ใช้ตารางที่ตั้งไว้
              </span>
              <fieldset className="space-y-1.5">
                <input
                  type="hidden"
                  name="timetableSlotId"
                  value={slotId === MANUAL ? "" : slotId}
                />
                {matchingSlots.map((slot) => (
                  <label
                    key={slot.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm transition-colors hover:bg-slate-50 has-[input:checked]:border-black has-[input:checked]:bg-black/[0.03]"
                  >
                    <input
                      type="radio"
                      name="slotChoice"
                      value={slot.id}
                      checked={slotId === slot.id}
                      onChange={() => onSlotChange(slot.id)}
                      className="accent-black"
                    />
                    <span className="font-medium">
                      วัน{dayOfWeekLabel(slot.dayOfWeek)} {slot.startTime}–
                      {slot.endTime} น.
                    </span>
                    {slot.location && (
                      <span className="text-xs text-black/50">
                        · {slot.location}
                      </span>
                    )}
                  </label>
                ))}
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm transition-colors hover:bg-slate-50 has-[input:checked]:border-black has-[input:checked]:bg-black/[0.03]">
                  <input
                    type="radio"
                    name="slotChoice"
                    value={MANUAL}
                    checked={slotId === MANUAL}
                    onChange={() => onSlotChange(MANUAL)}
                    className="accent-black"
                  />
                  <span>ไม่ใช้ตาราง (ระบุเวลาเอง)</span>
                </label>
              </fieldset>
              {matchingSlots.length === 0 && slots.length > 0 && (
                <p className="mt-1 text-xs text-black/40">
                  วันนี้ไม่มีคาบในตาราง — ใช้เวลาที่ระบุด้านล่าง
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="startTime"
                  className="mb-1.5 block text-xs font-medium text-black/60"
                >
                  เวลาเริ่ม
                </label>
                <input
                  type="time"
                  id="startTime"
                  name="startTime"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="input"
                />
                {state.fieldErrors?.startTime && (
                  <p className="mt-1 text-xs text-red-700">
                    {state.fieldErrors.startTime}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="endTime"
                  className="mb-1.5 block text-xs font-medium text-black/60"
                >
                  เวลาสิ้นสุด
                </label>
                <input
                  type="time"
                  id="endTime"
                  name="endTime"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="input"
                  aria-invalid={timeInvalid || undefined}
                />
                {(state.fieldErrors?.endTime || timeInvalid) && (
                  <p className="mt-1 text-xs text-red-700">
                    {state.fieldErrors?.endTime ??
                      "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม"}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="note"
                className="mb-1.5 block text-xs font-medium text-black/60"
              >
                บันทึก (ทางเลือก)
              </label>
              <input
                type="text"
                id="note"
                name="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="เช่น ทบทวนสอบ, ฝึกหัด"
                className="input"
                maxLength={200}
              />
            </div>

            {state.error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                {state.error === "session_already_exists"
                  ? "มีคาบที่เวลานี้อยู่แล้ว"
                  : state.error}
              </p>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              className="btn-secondary btn-sm"
            >
              ยกเลิก
            </button>
            <SubmitButton disabled={timeInvalid} />
          </div>
        </form>
      </dialog>
    </>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "กำลังเปิดคาบ…" : "เปิดคาบ"}
    </button>
  );
}
