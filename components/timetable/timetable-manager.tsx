"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  PencilLine,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { TimePicker } from "@/components/ui/time-picker";
import { WeeklyTimetable } from "@/components/timetable/weekly-timetable";
import {
  createSlotAction,
  deleteSlotAction,
  updateSlotAction,
  type TimetableSlotActionState,
} from "@/app/teacher/courses/[id]/settings/actions";
import {
  TIMETABLE_DAY_LABELS,
  TIMETABLE_DAY_ORDER,
  type TimetableDisplaySlot,
} from "@/lib/timetable/view-model";

export type TimetableCourseOption = {
  id: string;
  name: string;
  subjectCode: string | null;
  className: string;
};

type DialogState =
  | {
      mode: "create";
      defaults?: { dayOfWeek: number; startTime: string; endTime: string };
    }
  | { mode: "edit"; slot: TimetableDisplaySlot }
  | null;

type Props = {
  slots: TimetableDisplaySlot[];
  courses: TimetableCourseOption[];
  nowIso: string;
};

const INITIAL_STATE: TimetableSlotActionState = {};

export function TimetableManager({ slots, courses, nowIso }: Props) {
  const [dialog, setDialog] = useState<DialogState>(null);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <CalendarClock className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">
              จัดตารางจากหน้านี้ได้เลย
            </p>
            <p className="mt-0.5 text-xs text-ink-mute">
              กดคาบเพื่อแก้ไข หรือกดช่องว่างในตารางเพื่อเพิ่มคาบตามเวลานั้น
            </p>
          </div>
        </div>
        <button
          type="button"
          data-testid="timetable-add-slot"
          className="btn-primary btn-sm"
          onClick={() => setDialog({ mode: "create" })}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          เพิ่มคาบ
        </button>
      </div>

      <WeeklyTimetable
        slots={slots}
        role="teacher"
        nowIso={nowIso}
        onSlotSelect={(slot) => setDialog({ mode: "edit", slot })}
        onEmptyCellSelect={(defaults) =>
          setDialog({ mode: "create", defaults })
        }
      />

      {dialog && (
        <TimetableSlotDialog
          key={dialog.mode === "edit" ? dialog.slot.id : "new-slot"}
          slot={dialog.mode === "edit" ? dialog.slot : undefined}
          defaults={dialog.mode === "create" ? dialog.defaults : undefined}
          courses={courses}
          existingSlots={slots}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

export function TimetableSlotDialog({
  slot,
  defaults,
  courses,
  existingSlots = [],
  onClose,
}: {
  slot?: TimetableDisplaySlot;
  defaults?: { dayOfWeek: number; startTime: string; endTime: string };
  courses: TimetableCourseOption[];
  existingSlots?: TimetableDisplaySlot[];
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const saveAction = slot ? updateSlotAction : createSlotAction;
  const [saveState, saveFormAction, saving] = useActionState(
    saveAction,
    INITIAL_STATE
  );
  const [deleteState, deleteFormAction, deleting] = useActionState(
    deleteSlotAction,
    INITIAL_STATE
  );
  const [startTime, setStartTime] = useState(
    slot?.startTime ?? defaults?.startTime ?? "08:00"
  );
  const [endTime, setEndTime] = useState(
    slot?.endTime ?? defaults?.endTime ?? "09:00"
  );
  const [courseId, setCourseId] = useState(
    slot?.courseId ?? courses[0]?.id ?? ""
  );
  const [dayOfWeek, setDayOfWeek] = useState(
    slot?.dayOfWeek ?? defaults?.dayOfWeek ?? 1
  );

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    if (!saveState.ok && !deleteState.ok) return;
    router.refresh();
    onClose();
  }, [deleteState, onClose, router, saveState]);

  const selectedCourse = courses.find((course) => course.id === courseId);
  const overlappingSlots = existingSlots.filter(
    (candidate) =>
      candidate.id !== slot?.id &&
      candidate.dayOfWeek === dayOfWeek &&
      startTime < candidate.endTime &&
      candidate.startTime < endTime
  );
  const blockingOverlap = overlappingSlots.find(
    (candidate) => candidate.courseId === courseId
  );
  const advisoryOverlap = overlappingSlots.find(
    (candidate) => candidate.courseId !== courseId
  );

  return (
    <dialog
      ref={dialogRef}
      data-testid="timetable-slot-dialog"
      data-mode={slot ? "edit" : "create"}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className="fixed inset-0 m-auto h-fit max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-hairline bg-surface p-0 text-ink shadow-lift backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-700">
              {slot ? (
                <PencilLine className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Plus className="h-4 w-4" aria-hidden="true" />
              )}
            </span>
            <div>
              <h2 className="text-base font-semibold text-ink">
                {slot ? "แก้ไขคาบ" : "เพิ่มคาบใหม่"}
              </h2>
              <p className="mt-0.5 text-xs text-ink-mute">
                ตารางนี้ใช้เป็นเวลาเริ่มต้นเมื่อเปิดเช็คชื่อ
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          aria-label="ปิด"
          onClick={onClose}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-mute transition-colors hover:bg-bg hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <form action={saveFormAction} className="space-y-4 p-5">
        {slot && <input type="hidden" name="slotId" value={slot.id} />}

        <div>
          <label htmlFor="timetable-course" className="label">
            วิชาและห้องเรียน
          </label>
          {slot ? (
            <>
              <input type="hidden" name="courseId" value={slot.courseId} />
              <div className="mt-1.5 rounded-xl border border-hairline bg-bg px-3 py-2.5">
                <p className="text-sm font-semibold text-ink">
                  {selectedCourse?.name ?? slot.courseName}
                </p>
                <p className="mt-0.5 text-xs text-ink-mute">
                  {selectedCourse?.className ?? slot.className}
                </p>
              </div>
            </>
          ) : (
            <select
              id="timetable-course"
              name="courseId"
              className="input mt-1.5"
              required
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.subjectCode ? `${course.subjectCode} · ` : ""}
                  {course.name} · {course.className}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="timetable-day" className="label">
              วัน
            </label>
            <select
              id="timetable-day"
              name="dayOfWeek"
              className="input mt-1.5"
              required
              value={dayOfWeek}
              onChange={(event) => setDayOfWeek(Number(event.target.value))}
              aria-invalid={saveState.fieldErrors?.dayOfWeek ? true : undefined}
            >
              {TIMETABLE_DAY_ORDER.map((day) => (
                <option key={day} value={day}>
                  วัน{TIMETABLE_DAY_LABELS[day]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="timetable-location" className="label">
              สถานที่{" "}
              <span className="font-normal text-ink-faint">(ไม่บังคับ)</span>
            </label>
            <input
              id="timetable-location"
              name="location"
              className="input mt-1.5"
              maxLength={200}
              defaultValue={slot?.location ?? ""}
              placeholder="เช่น อาคาร 3 ห้อง 305"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">เริ่ม</label>
            <div className="mt-1.5">
              <TimePicker
                name="startTime"
                value={startTime}
                onChange={setStartTime}
                required
                ariaLabel="เวลาเริ่มคาบ"
              />
            </div>
          </div>
          <div>
            <label className="label">สิ้นสุด</label>
            <div className="mt-1.5">
              <TimePicker
                name="endTime"
                value={endTime}
                onChange={setEndTime}
                required
                ariaLabel="เวลาสิ้นสุดคาบ"
              />
            </div>
          </div>
        </div>

        {blockingOverlap ? (
          <OverlapNotice
            tone="danger"
            slot={blockingOverlap}
            message="คาบของวิชาเดียวกันทับซ้อนกัน กรุณาเลือกวันหรือเวลาใหม่ก่อนบันทึก"
          />
        ) : advisoryOverlap ? (
          <OverlapNotice
            tone="warning"
            slot={advisoryOverlap}
            message="เวลานี้ตรงกับอีกวิชาหนึ่ง ระบบยังบันทึกได้ แต่ควรตรวจสอบตารางอีกครั้ง"
          />
        ) : null}

        <FormErrors state={saveState} />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
          {slot ? (
            <button
              type="submit"
              form="delete-timetable-slot"
              data-testid="timetable-delete-slot"
              disabled={saving || deleting}
              className="btn-danger btn-sm"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {deleting ? "กำลังลบ…" : "ลบคาบ"}
            </button>
          ) : (
            <span />
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={onClose}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              data-testid="timetable-save-slot"
              className="btn-primary btn-sm"
              disabled={
                saving || deleting || courses.length === 0 || !!blockingOverlap
              }
            >
              {saving ? "กำลังบันทึก…" : slot ? "บันทึกการแก้ไข" : "เพิ่มคาบ"}
            </button>
          </div>
        </div>
      </form>

      {slot && (
        <form id="delete-timetable-slot" action={deleteFormAction}>
          <input type="hidden" name="courseId" value={slot.courseId} />
          <input type="hidden" name="slotId" value={slot.id} />
          {deleteState.error && (
            <p className="px-5 pb-4 text-xs text-red-700">
              {deleteState.error}
            </p>
          )}
        </form>
      )}
    </dialog>
  );
}

function OverlapNotice({
  tone,
  slot,
  message,
}: {
  tone: "danger" | "warning";
  slot: TimetableDisplaySlot;
  message: string;
}) {
  const danger = tone === "danger";
  return (
    <div
      className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${
        danger
          ? "border-red-500/25 bg-red-50 text-red-700"
          : "border-amber-500/25 bg-amber-50 text-amber-700"
      }`}
      role={danger ? "alert" : "status"}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">{message}</p>
        <p className="mt-0.5 opacity-80">
          {slot.courseName} · วัน{TIMETABLE_DAY_LABELS[slot.dayOfWeek]} ·{" "}
          {slot.startTime}–{slot.endTime}
        </p>
      </div>
    </div>
  );
}

function FormErrors({ state }: { state: TimetableSlotActionState }) {
  const messages = state.fieldErrors ? Object.values(state.fieldErrors) : [];
  if (!state.error && messages.length === 0) return null;
  return (
    <div className="rounded-xl border border-red-500/25 bg-red-50 px-3 py-2 text-xs text-red-700">
      {state.error && <p>{state.error}</p>}
      {messages.map((message) => (
        <p key={message}>{message}</p>
      ))}
    </div>
  );
}
