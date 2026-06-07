"use client";

import { useMemo, useState } from "react";
// useState lazy initializer captures Date.now once at mount, sidestepping
// the React 19 purity lint that flags Date.now() inside useMemo.
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { AttendanceStatus } from "@prisma/client";
import { CheckCheck, Eraser, AlertTriangle } from "lucide-react";
import {
  submitGridAction,
  type SubmitGridState,
} from "@/app/teacher/courses/[id]/attendance/[sessionId]/actions";

const INITIAL_STATE: SubmitGridState = {};
const STATUSES = ["PRESENT", "LATE", "EXCUSED", "ABSENT"] as const;
const STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "มา",
  LATE: "สาย",
  EXCUSED: "ลา",
  ABSENT: "ขาด",
};
const STATUS_ACTIVE: Record<AttendanceStatus, string> = {
  PRESENT: "bg-green-100 text-green-700 ring-1 ring-green-300",
  LATE: "bg-orange-100 text-orange-700 ring-1 ring-orange-300",
  EXCUSED: "bg-blue-100 text-blue-700 ring-1 ring-blue-300",
  ABSENT: "bg-red-100 text-red-700 ring-1 ring-red-300",
};
const REASON_MIN = 5;
const REASON_MAX = 500;
const BACK_EDIT_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export type GridStudentRow = {
  enrollmentId: string;
  removed: boolean;
  studentName: string;
  studentIdNumber: string;
  initialStatus: AttendanceStatus | null;
  initialNote: string | null;
  editCount: number;
};

type Props = {
  courseId: string;
  sessionId: string;
  scheduledStartIso: string; // ISO string — client computes back-edit
  rows: GridStudentRow[];
  cancelled: boolean;
};

export function AttendanceGrid({
  courseId,
  sessionId,
  scheduledStartIso,
  rows,
  cancelled,
}: Props) {
  const [statuses, setStatuses] = useState<
    Record<string, AttendanceStatus | null>
  >(() =>
    Object.fromEntries(rows.map((r) => [r.enrollmentId, r.initialStatus]))
  );
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.enrollmentId, r.initialNote ?? ""]))
  );
  const [reason, setReason] = useState("");
  const [state, formAction] = useActionState(submitGridAction, INITIAL_STATE);

  // Captured once at mount — 24h threshold is orders of magnitude larger
  // than a mark-attendance session, so a frozen value at mount is correct.
  const [isBackEdit] = useState(
    () =>
      Date.now() - new Date(scheduledStartIso).getTime() >
      BACK_EDIT_THRESHOLD_MS
  );

  const hasUnsavedChange = useMemo(() => {
    for (const r of rows) {
      if (statuses[r.enrollmentId] !== r.initialStatus) return true;
      if ((notes[r.enrollmentId] ?? "") !== (r.initialNote ?? "")) return true;
    }
    return false;
  }, [rows, statuses, notes]);

  const reasonLen = reason.trim().length;
  const reasonRequired = isBackEdit && hasUnsavedChange;
  const reasonValid =
    !reasonRequired || (reasonLen >= REASON_MIN && reasonLen <= REASON_MAX);

  const markedCount = useMemo(
    () => rows.filter((r) => statuses[r.enrollmentId] != null).length,
    [rows, statuses]
  );

  const canSubmit =
    !cancelled && markedCount > 0 && reasonValid && hasUnsavedChange;

  const setStatus = (enrollmentId: string, status: AttendanceStatus) => {
    setStatuses((prev) => ({ ...prev, [enrollmentId]: status }));
  };

  const setNote = (enrollmentId: string, note: string) => {
    setNotes((prev) => ({ ...prev, [enrollmentId]: note }));
  };

  const bulkAllPresent = () => {
    setStatuses((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        if (!r.removed) next[r.enrollmentId] = "PRESENT";
      }
      return next;
    });
  };

  const bulkClear = () => {
    setStatuses((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        if (!r.removed) next[r.enrollmentId] = null;
      }
      return next;
    });
  };

  if (rows.length === 0) {
    return (
      <div className="card-flat p-8 text-center">
        <p className="text-sm text-black/60">ยังไม่มีนักเรียนในห้อง</p>
        <a
          href={`/teacher/courses/${courseId}/members`}
          className="mt-3 inline-block text-sm text-black underline"
        >
          ไปแท็บสมาชิก →
        </a>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="sessionId" value={sessionId} />

      {/* Hidden status/note fields — reflect current state for FormData. */}
      {rows.map((r) => {
        const s = statuses[r.enrollmentId];
        if (s == null) return null;
        return (
          <div key={`hidden_${r.enrollmentId}`}>
            <input type="hidden" name={`status_${r.enrollmentId}`} value={s} />
            {notes[r.enrollmentId] ? (
              <input
                type="hidden"
                name={`note_${r.enrollmentId}`}
                value={notes[r.enrollmentId]}
              />
            ) : null}
          </div>
        );
      })}

      {/* Top bar — bulk actions + counter */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-black/50">
          เช็คชื่อแล้ว {markedCount}/{rows.length} คน
        </p>
        {!cancelled && (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={bulkAllPresent}
              className="btn-secondary btn-sm"
            >
              <CheckCheck className="mr-1 inline h-3.5 w-3.5" />
              ทุกคนมา
            </button>
            <button
              type="button"
              onClick={bulkClear}
              className="btn-ghost btn-sm"
            >
              <Eraser className="mr-1 inline h-3.5 w-3.5" />
              ล้าง
            </button>
          </div>
        )}
      </div>

      {isBackEdit && (
        <div className="mb-3 flex items-start gap-2 rounded-xl bg-orange-50 px-3 py-2 text-xs text-orange-700 ring-1 ring-orange-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">คาบนี้ผ่านมาเกิน 24 ชั่วโมงแล้ว</p>
            <p className="mt-0.5">
              การแก้ไขสถานะใด ๆ จะถูกบันทึก audit พร้อมเหตุผลที่ระบุด้านล่าง
            </p>
          </div>
        </div>
      )}

      {/* Mobile card list — visible <md */}
      <div className="space-y-2 md:hidden">
        {rows.map((r) => (
          <StudentCard
            key={r.enrollmentId}
            row={r}
            status={statuses[r.enrollmentId]}
            note={notes[r.enrollmentId] ?? ""}
            cancelled={cancelled}
            onStatus={(s) => setStatus(r.enrollmentId, s)}
            onNote={(n) => setNote(r.enrollmentId, n)}
          />
        ))}
      </div>

      {/* Desktop table — visible md+ */}
      <div className="hidden md:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-medium text-black/50">
              <th className="py-2 pr-2">นักเรียน</th>
              <th className="py-2 px-2">สถานะ</th>
              <th className="py-2 pl-2">บันทึก</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <StudentRow
                key={r.enrollmentId}
                row={r}
                status={statuses[r.enrollmentId]}
                note={notes[r.enrollmentId] ?? ""}
                cancelled={cancelled}
                onStatus={(s) => setStatus(r.enrollmentId, s)}
                onNote={(n) => setNote(r.enrollmentId, n)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {reasonRequired && (
        <div className="mt-4">
          <label
            htmlFor="reason"
            className="mb-1.5 block text-xs font-medium text-black/60"
          >
            เหตุผลในการแก้ย้อนหลัง (จำเป็น)
          </label>
          <textarea
            id="reason"
            name="reason"
            rows={2}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="เช่น พบความคลาดเคลื่อนหลังตรวจสอบกับเอกสารลา"
            className="input resize-none"
          />
          <div className="mt-1 flex items-center justify-between text-xs">
            <span
              className={
                reasonLen > 0 && reasonLen < REASON_MIN
                  ? "text-red-700"
                  : "text-black/40"
              }
            >
              {reasonLen > 0 && reasonLen < REASON_MIN
                ? `ขั้นต่ำ ${REASON_MIN} ตัวอักษร`
                : `${REASON_MIN}–${REASON_MAX} ตัวอักษร · จะบันทึก audit`}
            </span>
            <span
              className={
                reasonLen > REASON_MAX
                  ? "font-medium text-red-700"
                  : "text-black/40"
              }
            >
              {reasonLen}/{REASON_MAX}
            </span>
          </div>
          {state.fieldErrors?.reason && (
            <p className="mt-1 text-xs text-red-700">
              {state.fieldErrors.reason}
            </p>
          )}
        </div>
      )}

      {!reasonRequired && reasonLen === 0 && (
        // Keep `reason` field in the form even when not required, so the
        // server can validate it if its threshold check disagrees with ours
        // (clock skew, race past the 24h mark). Sent as empty.
        <input type="hidden" name="reason" value="" />
      )}

      {state.error && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-xs text-green-700">
          บันทึกแล้ว ({state.marked} คน
          {state.audited ? " · บันทึก audit" : ""})
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <SubmitButton disabled={!canSubmit} />
      </div>
    </form>
  );
}

function StatusButtons({
  status,
  disabled,
  onStatus,
}: {
  status: AttendanceStatus | null;
  disabled: boolean;
  onStatus: (s: AttendanceStatus) => void;
}) {
  return (
    <fieldset
      role="radiogroup"
      aria-label="สถานะ"
      disabled={disabled}
      className="flex gap-1.5"
    >
      {STATUSES.map((s) => {
        const active = status === s;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onStatus(s)}
            disabled={disabled}
            className={
              "h-11 min-w-[3rem] rounded-lg px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 " +
              (active
                ? STATUS_ACTIVE[s]
                : "border border-slate-200 text-slate-600 hover:bg-slate-50")
            }
          >
            {STATUS_LABEL[s]}
          </button>
        );
      })}
    </fieldset>
  );
}

function StudentCard({
  row,
  status,
  note,
  cancelled,
  onStatus,
  onNote,
}: {
  row: GridStudentRow;
  status: AttendanceStatus | null;
  note: string;
  cancelled: boolean;
  onStatus: (s: AttendanceStatus) => void;
  onNote: (n: string) => void;
}) {
  const disabled = cancelled || row.removed;
  return (
    <div className={"card-flat p-3 " + (row.removed ? "opacity-60" : "")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-black">
            {row.studentName}
            {row.removed && (
              <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700">
                ถูกนำออกแล้ว
              </span>
            )}
          </p>
          <p className="text-xs text-black/40 font-mono">
            {row.studentIdNumber}
          </p>
        </div>
      </div>
      <StatusButtons status={status} disabled={disabled} onStatus={onStatus} />
      <input
        type="text"
        value={note}
        onChange={(e) => onNote(e.target.value)}
        placeholder="บันทึก (ทางเลือก)"
        disabled={disabled}
        maxLength={200}
        className="input mt-2 text-xs disabled:opacity-60"
      />
    </div>
  );
}

function StudentRow({
  row,
  status,
  note,
  cancelled,
  onStatus,
  onNote,
}: {
  row: GridStudentRow;
  status: AttendanceStatus | null;
  note: string;
  cancelled: boolean;
  onStatus: (s: AttendanceStatus) => void;
  onNote: (n: string) => void;
}) {
  const disabled = cancelled || row.removed;
  return (
    <tr
      className={
        "border-b border-slate-100 align-middle " +
        (row.removed ? "opacity-60" : "")
      }
    >
      <td className="py-2 pr-2">
        <p className="text-sm font-medium text-black">
          {row.studentName}
          {row.removed && (
            <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700">
              ถูกนำออกแล้ว
            </span>
          )}
        </p>
        <p className="text-xs text-black/40 font-mono">{row.studentIdNumber}</p>
      </td>
      <td className="py-2 px-2">
        <StatusButtons
          status={status}
          disabled={disabled}
          onStatus={onStatus}
        />
      </td>
      <td className="py-2 pl-2">
        <input
          type="text"
          value={note}
          onChange={(e) => onNote(e.target.value)}
          placeholder="—"
          disabled={disabled}
          maxLength={200}
          className="input text-xs disabled:opacity-60"
        />
      </td>
    </tr>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "กำลังบันทึก…" : "บันทึกการเช็คชื่อ"}
    </button>
  );
}
