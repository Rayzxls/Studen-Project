"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, RotateCcw, X } from "lucide-react";
import {
  quickGradeAndAdvanceAction,
  returnAndAdvanceAction,
  type GradeSubmissionState,
  type ReturnSubmissionState,
} from "@/app/teacher/courses/[id]/assignments/[assignmentId]/actions";

/**
 * Assignment Review Workspace — grading panel (Phase 11).
 *
 * The right column of the master-detail workspace. One panel, two actions,
 * no dialogs (CONTEXT § Assignment Review Workspace):
 *
 *   ยืนยัน / ตรวจเสร็จ — primary. Saves the score (scored Assignment) and
 *     marks the submission GRADED in one step, then the server action
 *     redirects to the next queued submission.
 *   ส่งคืนให้แก้      — secondary. Expands an inline feedback textarea
 *     (≥ 5 chars) instead of opening a separate dialog; submitting returns
 *     the work and advances to the next queued submission.
 *
 * Both actions redirect on success, so `useActionState` here only ever
 * surfaces validation errors.
 */
export function ReviewPanel({
  courseId,
  assignmentId,
  submissionId,
  isScored,
  fullScore,
  isScoreItemPublished,
  currentValue,
}: {
  courseId: string;
  assignmentId: string;
  submissionId: string;
  isScored: boolean;
  fullScore: number | null;
  isScoreItemPublished: boolean;
  currentValue: number | null;
}) {
  const [gradeState, gradeAction, grading] = useActionState<
    GradeSubmissionState,
    FormData
  >(quickGradeAndAdvanceAction, {});
  const [returnState, returnAction, returning] = useActionState<
    ReturnSubmissionState,
    FormData
  >(returnAndAdvanceAction, {});

  const [returnOpen, setReturnOpen] = useState(false);

  const primaryLabel = isScored ? "ยืนยันคะแนน" : "ตรวจเสร็จ";

  return (
    <div className="space-y-4">
      {/* Primary — grade + mark graded + advance */}
      <form action={gradeAction} className="space-y-4">
        <input type="hidden" name="courseId" value={courseId} />
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <input type="hidden" name="submissionId" value={submissionId} />

        {isScored ? (
          <>
            <div>
              <label className="block text-xs font-medium text-black/70">
                คะแนน <span className="text-black/40">(0..{fullScore})</span>
              </label>
              <input
                type="number"
                name="value"
                min={0}
                max={fullScore ?? undefined}
                step={1}
                defaultValue={currentValue ?? ""}
                autoFocus
                className="input mt-1 text-lg font-semibold"
                placeholder="—"
              />
              {gradeState.fieldErrors?.value && (
                <p className="mt-1 text-xs text-red-700">
                  {gradeState.fieldErrors.value}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-black/70">
                หมายเหตุ <span className="text-black/40">(เห็นเฉพาะครู)</span>
              </label>
              <input
                type="text"
                name="note"
                maxLength={200}
                className="input mt-1"
                placeholder="ไม่แสดงให้นักเรียน"
              />
            </div>
            {isScoreItemPublished && (
              <div>
                <label className="block text-xs font-medium text-black/70">
                  เหตุผลการแก้คะแนนหลังเผยแพร่{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="reason"
                  minLength={5}
                  maxLength={500}
                  className="input mt-1"
                  placeholder="≥ 5 ตัวอักษร · บันทึก audit"
                />
                {gradeState.fieldErrors?.reason && (
                  <p className="mt-1 text-xs text-red-700">
                    {gradeState.fieldErrors.reason}
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="rounded-xl bg-black/[0.03] px-3 py-2.5 text-xs leading-5 text-black/55">
            งานนี้ไม่นับคะแนน — กด “ตรวจเสร็จ” เพื่อยืนยันว่าตรวจงานนี้แล้ว
          </p>
        )}

        {gradeState.error && (
          <p className="text-xs text-red-700">{gradeState.error}</p>
        )}

        <button
          type="submit"
          disabled={grading || returning}
          className="btn-primary w-full justify-center"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {grading ? "กำลังบันทึก…" : `${primaryLabel} · ถัดไป`}
        </button>
      </form>

      {/* Secondary — return for revision (inline, no dialog) */}
      <div className="border-t border-black/5 pt-4">
        {!returnOpen ? (
          <button
            type="button"
            onClick={() => setReturnOpen(true)}
            className="btn-secondary w-full justify-center text-red-700"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            ส่งคืนให้แก้
          </button>
        ) : (
          <form action={returnAction} className="space-y-3">
            <input type="hidden" name="courseId" value={courseId} />
            <input type="hidden" name="assignmentId" value={assignmentId} />
            <input type="hidden" name="submissionId" value={submissionId} />

            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-black/70">
                สิ่งที่ให้นักเรียนแก้ <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setReturnOpen(false)}
                className="grid h-6 w-6 place-items-center rounded-full text-black/40 hover:bg-black/5 hover:text-black"
                aria-label="ปิด"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <textarea
              name="comment"
              rows={4}
              minLength={5}
              maxLength={500}
              required
              autoFocus
              className="input"
              placeholder="เช่น 'เพิ่มเหตุผลในข้อ 2 หน่อยครับ' · ≥ 5 ตัวอักษร · เป็นคอมเมนต์ส่วนตัวถึงนักเรียน"
            />
            {returnState.fieldErrors?.comment && (
              <p className="text-xs text-red-700">
                {returnState.fieldErrors.comment}
              </p>
            )}
            {returnState.error && (
              <p className="text-xs text-red-700">{returnState.error}</p>
            )}
            <button
              type="submit"
              disabled={returning || grading}
              className="btn-danger w-full justify-center"
            >
              {returning ? "กำลังส่งคืน…" : "ส่งคืน · ถัดไป"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
