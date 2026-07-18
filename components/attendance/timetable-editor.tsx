"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Trash2 } from "lucide-react";
import { TimePicker } from "@/components/ui/time-picker";
import {
  createSlotAction,
  deleteSlotAction,
  type TimetableSlotActionState,
} from "@/app/teacher/courses/[id]/settings/actions";
import { dayOfWeekLabel } from "@/lib/attendance/format";

const INITIAL_CREATE: TimetableSlotActionState = {};
const INITIAL_DELETE: TimetableSlotActionState = {};

export type TimetableSlotRow = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location: string | null;
};

type Props = {
  courseId: string;
  slots: TimetableSlotRow[];
};

const DOW_OPTIONS = [0, 1, 2, 3, 4, 5, 6] as const;

export function TimetableEditor({ courseId, slots }: Props) {
  return (
    <div className="card p-6">
      <div className="mb-4">
        <h3
          className="text-base font-medium text-black"
          style={{ letterSpacing: "-0.02em" }}
        >
          ตารางสอน
        </h3>
        <p className="mt-0.5 text-xs text-black/50">
          ใช้ตั้ง default เวลาตอน &ldquo;เปิดคาบ&rdquo; —
          แก้ภายหลังไม่กระทบคาบที่เปิดไปแล้ว
        </p>
      </div>

      {slots.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-black/50">
          ยังไม่มีตารางสอน — เพิ่มด้านล่าง (จะใช้ได้กับการเปิดคาบครั้งถัดไป)
        </p>
      ) : (
        <ul className="mb-4 divide-y divide-slate-100">
          {slots.map((slot) => (
            <SlotRow key={slot.id} courseId={courseId} slot={slot} />
          ))}
        </ul>
      )}

      <AddSlotForm courseId={courseId} />
    </div>
  );
}

function SlotRow({
  courseId,
  slot,
}: {
  courseId: string;
  slot: TimetableSlotRow;
}) {
  const [state, formAction] = useActionState(deleteSlotAction, INITIAL_DELETE);
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-black">
          วัน{dayOfWeekLabel(slot.dayOfWeek)} · {slot.startTime}–{slot.endTime}{" "}
          น.
        </p>
        {slot.location && (
          <p className="mt-0.5 truncate text-xs text-black/50">
            {slot.location}
          </p>
        )}
        {state.error && (
          <p className="mt-0.5 text-xs text-red-700">{state.error}</p>
        )}
      </div>
      <form action={formAction}>
        <input type="hidden" name="courseId" value={courseId} />
        <input type="hidden" name="slotId" value={slot.id} />
        <DeleteButton />
      </form>
    </li>
  );
}

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="ลบ"
      className="rounded-full p-1.5 text-black/40 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

function AddSlotForm({ courseId }: { courseId: string }) {
  const [state, formAction] = useActionState(createSlotAction, INITIAL_CREATE);
  return (
    <form
      action={formAction}
      className="rounded-xl border border-slate-200 p-3"
    >
      <input type="hidden" name="courseId" value={courseId} />
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[8rem_6rem_6rem_1fr_auto] md:items-end">
        <div>
          <label
            htmlFor="dayOfWeek"
            className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-black/40"
          >
            วัน
          </label>
          <select
            id="dayOfWeek"
            name="dayOfWeek"
            required
            defaultValue="1"
            className="input"
            aria-invalid={state.fieldErrors?.dayOfWeek ? true : undefined}
          >
            {DOW_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {dayOfWeekLabel(d)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="startTime"
            className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-black/40"
          >
            เริ่ม
          </label>
          <TimePicker
            id="startTime"
            name="startTime"
            required
            defaultValue="13:00"
            ariaLabel="เวลาเริ่มคาบ"
          />
        </div>
        <div>
          <label
            htmlFor="endTime"
            className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-black/40"
          >
            สิ้นสุด
          </label>
          <TimePicker
            id="endTime"
            name="endTime"
            required
            defaultValue="14:00"
            ariaLabel="เวลาสิ้นสุดคาบ"
          />
        </div>
        <div>
          <label
            htmlFor="location"
            className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-black/40"
          >
            สถานที่ (ทางเลือก)
          </label>
          <input
            type="text"
            id="location"
            name="location"
            placeholder="เช่น อาคาร 3 ห้อง 305"
            maxLength={200}
            className="input"
          />
        </div>
        <AddButton />
      </div>
      {(state.fieldErrors?.dayOfWeek ||
        state.fieldErrors?.startTime ||
        state.fieldErrors?.endTime ||
        state.fieldErrors?.location) && (
        <ul className="mt-2 space-y-0.5 text-xs text-red-700">
          {state.fieldErrors?.dayOfWeek && (
            <li>วัน: {state.fieldErrors.dayOfWeek}</li>
          )}
          {state.fieldErrors?.startTime && (
            <li>เริ่ม: {state.fieldErrors.startTime}</li>
          )}
          {state.fieldErrors?.endTime && (
            <li>สิ้นสุด: {state.fieldErrors.endTime}</li>
          )}
          {state.fieldErrors?.location && (
            <li>สถานที่: {state.fieldErrors.location}</li>
          )}
        </ul>
      )}
      {state.error && (
        <p className="mt-2 text-xs text-red-700">{state.error}</p>
      )}
    </form>
  );
}

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary btn-sm h-[42px] disabled:opacity-50"
    >
      <Plus className="mr-1 inline h-3.5 w-3.5" />
      {pending ? "กำลังเพิ่ม…" : "เพิ่ม"}
    </button>
  );
}
