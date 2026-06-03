"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Award, AlertTriangle } from "lucide-react";
import {
  submitScoreGridAction,
  type SubmitGridState,
} from "@/app/teacher/courses/[id]/scores/[scoreItemId]/actions";

const INITIAL_STATE: SubmitGridState = {};
const REASON_MIN = 5;
const REASON_MAX = 500;

export type ScoreGridRow = {
  enrollmentId: string;
  removed: boolean;
  studentName: string;
  studentIdNumber: string;
  initialValue: number | null;
  initialNote: string | null;
  editCount: number;
};

type Props = {
  courseId: string;
  scoreItemId: string;
  fullScore: number;
  /** Whether the parent ScoreItem is already published — drives the reason gate. */
  isPublished: boolean;
  rows: ScoreGridRow[];
};

/**
 * Per-ScoreItem score grid for the teacher — dual-layout (mobile cards +
 * desktop table) per Pattern 13, mirroring the Phase 4 attendance grid.
 *
 * Reason gate (ADR-0018 § Decision 2 + Pattern 10):
 *   - Triggered when `isPublished === true` AND there is at least one
 *     real value change vs the initial server snapshot. Note-only edits
 *     do NOT trigger (matches the lib's `bulkUpsertScoreEntries` rule).
 *   - When triggered, a textarea field surfaces and submit is gated on
 *     a `5..500` length.
 *
 * Empty cells (value === "") are SKIPPED at submit — they don't upsert
 * the row to 0. To set a real zero, the teacher types "0".
 */
export function ScoreGrid({
  courseId,
  scoreItemId,
  fullScore,
  isPublished,
  rows,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      rows.map((r) => [
        r.enrollmentId,
        r.initialValue === null ? "" : String(r.initialValue),
      ])
    )
  );
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.enrollmentId, r.initialNote ?? ""]))
  );
  const [reason, setReason] = useState("");
  const [state, formAction] = useActionState(
    submitScoreGridAction,
    INITIAL_STATE
  );

  const hasUnsavedChange = useMemo(() => {
    for (const r of rows) {
      const cur = values[r.enrollmentId] ?? "";
      const initial = r.initialValue === null ? "" : String(r.initialValue);
      if (cur !== initial) return true;
      if ((notes[r.enrollmentId] ?? "") !== (r.initialNote ?? "")) return true;
    }
    return false;
  }, [rows, values, notes]);

  const hasValueChange = useMemo(() => {
    for (const r of rows) {
      const cur = values[r.enrollmentId] ?? "";
      const initial = r.initialValue === null ? "" : String(r.initialValue);
      if (cur !== initial) return true;
    }
    return false;
  }, [rows, values]);

  const reasonLen = reason.trim().length;
  const reasonRequired = isPublished && hasValueChange;
  const reasonValid =
    !reasonRequired || (reasonLen >= REASON_MIN && reasonLen <= REASON_MAX);

  const filledCount = useMemo(
    () => rows.filter((r) => (values[r.enrollmentId] ?? "") !== "").length,
    [rows, values]
  );

  const canSubmit = hasUnsavedChange && reasonValid;

  const setValue = (enrollmentId: string, value: string) => {
    setValues((prev) => ({ ...prev, [enrollmentId]: value }));
  };
  const setNote = (enrollmentId: string, note: string) => {
    setNotes((prev) => ({ ...prev, [enrollmentId]: note }));
  };

  const bulkFillFull = () => {
    setValues((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        if (!r.removed) next[r.enrollmentId] = String(fullScore);
      }
      return next;
    });
  };

  const bulkClear = () => {
    setValues((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        if (!r.removed) next[r.enrollmentId] = "";
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
      <input type="hidden" name="scoreItemId" value={scoreItemId} />

      {/* Hidden value/note fields — mirror current state for FormData.
          Empty value → don't emit the hidden field (skip semantic). */}
      {rows.map((r) => {
        const v = values[r.enrollmentId] ?? "";
        if (v === "") return null;
        return (
          <div key={`hidden_${r.enrollmentId}`}>
            <input type="hidden" name={`value_${r.enrollmentId}`} value={v} />
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

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-black/50">
          กรอกแล้ว {filledCount}/{rows.length} คน
        </p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={bulkFillFull}
            className="btn-secondary btn-sm"
          >
            <Award className="mr-1 inline h-3.5 w-3.5" />
            ทุกคนคะแนนเต็ม
          </button>
          <button
            type="button"
            onClick={bulkClear}
            className="btn-ghost btn-sm"
          >
            ล้าง
          </button>
        </div>
      </div>

      {isPublished && (
        <div className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">รายการคะแนนนี้เผยแพร่แล้ว</p>
            <p className="mt-0.5">
              การแก้คะแนนจะถูกบันทึก audit พร้อมเหตุผลที่ระบุด้านล่าง (ขั้นต่ำ{" "}
              {REASON_MIN} ตัวอักษร)
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
            value={values[r.enrollmentId] ?? ""}
            note={notes[r.enrollmentId] ?? ""}
            fullScore={fullScore}
            fieldError={state.fieldErrors?.[`value_${r.enrollmentId}`]}
            onValue={(v) => setValue(r.enrollmentId, v)}
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
              <th className="py-2 px-2 w-32">คะแนน / {fullScore}</th>
              <th className="py-2 pl-2">บันทึก</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <StudentRow
                key={r.enrollmentId}
                row={r}
                value={values[r.enrollmentId] ?? ""}
                note={notes[r.enrollmentId] ?? ""}
                fullScore={fullScore}
                fieldError={state.fieldErrors?.[`value_${r.enrollmentId}`]}
                onValue={(v) => setValue(r.enrollmentId, v)}
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
            เหตุผลในการแก้คะแนนหลังเผยแพร่ (จำเป็น)
          </label>
          <textarea
            id="reason"
            name="reason"
            rows={2}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="เช่น พิมพ์คะแนนผิดในรอบเผยแพร่"
            className="input resize-none"
          />
          <div className="mt-1 flex items-center justify-between text-xs">
            <span
              className={
                reasonLen > 0 && reasonLen < REASON_MIN
                  ? "text-rose-600"
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
                  ? "font-medium text-rose-600"
                  : "text-black/40"
              }
            >
              {reasonLen}/{REASON_MAX}
            </span>
          </div>
          {state.fieldErrors?.reason && (
            <p className="mt-1 text-xs text-rose-600">
              {state.fieldErrors.reason}
            </p>
          )}
        </div>
      )}

      {!reasonRequired && <input type="hidden" name="reason" value="" />}

      {state.error && (
        <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {state.error === "no_changes" ? "ไม่มีคะแนนที่กรอก" : state.error}
        </p>
      )}
      {state.ok && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          บันทึกแล้ว ({state.upserted} คน
          {state.audited ? " · บันทึก audit" : ""})
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <SubmitButton disabled={!canSubmit} />
      </div>
    </form>
  );
}

function ValueInput({
  value,
  fullScore,
  disabled,
  fieldError,
  onValue,
}: {
  value: string;
  fullScore: number;
  disabled: boolean;
  fieldError: string | undefined;
  onValue: (v: string) => void;
}) {
  return (
    <div>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onValue(e.target.value)}
        min={0}
        max={fullScore}
        step={1}
        placeholder="—"
        disabled={disabled}
        className="input h-11 w-24 text-right disabled:opacity-60"
        aria-invalid={fieldError ? "true" : undefined}
      />
      {fieldError && <p className="mt-1 text-xs text-rose-600">{fieldError}</p>}
    </div>
  );
}

function StudentCard({
  row,
  value,
  note,
  fullScore,
  fieldError,
  onValue,
  onNote,
}: {
  row: ScoreGridRow;
  value: string;
  note: string;
  fullScore: number;
  fieldError: string | undefined;
  onValue: (v: string) => void;
  onNote: (n: string) => void;
}) {
  const disabled = row.removed;
  return (
    <div className={"card-flat p-3 " + (row.removed ? "opacity-60" : "")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-black">
            {row.studentName}
            {row.removed && (
              <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] text-rose-700">
                ถูกนำออกแล้ว
              </span>
            )}
          </p>
          <p className="text-xs text-black/40 font-mono">
            {row.studentIdNumber}
          </p>
        </div>
        <ValueInput
          value={value}
          fullScore={fullScore}
          disabled={disabled}
          fieldError={fieldError}
          onValue={onValue}
        />
      </div>
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
  value,
  note,
  fullScore,
  fieldError,
  onValue,
  onNote,
}: {
  row: ScoreGridRow;
  value: string;
  note: string;
  fullScore: number;
  fieldError: string | undefined;
  onValue: (v: string) => void;
  onNote: (n: string) => void;
}) {
  const disabled = row.removed;
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
            <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] text-rose-700">
              ถูกนำออกแล้ว
            </span>
          )}
        </p>
        <p className="text-xs text-black/40 font-mono">{row.studentIdNumber}</p>
      </td>
      <td className="py-2 px-2">
        <ValueInput
          value={value}
          fullScore={fullScore}
          disabled={disabled}
          fieldError={fieldError}
          onValue={onValue}
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
      {pending ? "กำลังบันทึก…" : "บันทึกคะแนน"}
    </button>
  );
}
