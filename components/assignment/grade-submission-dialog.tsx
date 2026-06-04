"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  gradeSubmissionAction,
  type GradeSubmissionState,
} from "@/app/teacher/courses/[id]/assignments/[assignmentId]/actions";

/**
 * Grade submission dialog — Pattern 7 native <dialog>.
 *
 * For scored Assignment: input value 0..fullScore + optional note.
 * When the linked ScoreItem is published, a reason field (≥ 5 chars)
 * appears — this is the ADR-0018 post-publish gate inherited from
 * Phase 5 (lib/assignment.gradeSubmission re-implements the gate
 * locally per ADR-0020 § 4 to avoid a circular import).
 *
 * "ตรวจเสร็จ (Mark Graded)" checkbox transitions Submission.status
 * → GRADED. Forward-only per ADR-0020 § 2.
 */
export function GradeSubmissionDialog({
  courseId,
  assignmentId,
  submissionId,
  studentName,
  currentValue,
  fullScore,
  isScored,
  isScoreItemPublished,
  triggerLabel = "ตรวจ",
}: {
  courseId: string;
  assignmentId: string;
  submissionId: string;
  studentName: string;
  currentValue: number | null;
  fullScore: number | null; // null when Assignment is ungraded
  isScored: boolean;
  isScoreItemPublished: boolean;
  triggerLabel?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [state, formAction, isPending] = useActionState<
    GradeSubmissionState,
    FormData
  >(gradeSubmissionAction, {});

  useEffect(() => {
    if (!state.ok) return;
    setTimeout(() => {
      const d = dialogRef.current;
      if (!d) return;
      d.close();
      d.removeAttribute("open");
    }, 0);
  }, [state.ok]);

  return (
    <>
      <button
        type="button"
        className="btn-ghost btn-sm"
        onClick={() => dialogRef.current?.showModal()}
      >
        {triggerLabel}
      </button>

      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-md rounded-2xl border border-black/10 bg-white p-0 shadow-soft backdrop:bg-black/40"
      >
        <form action={formAction} className="p-6">
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name="assignmentId" value={assignmentId} />
          <input type="hidden" name="submissionId" value={submissionId} />

          <h3 className="text-lg font-medium text-black">
            ตรวจงาน — {studentName}
          </h3>
          {isScored && (
            <p className="mt-0.5 text-xs text-black/50">
              คะแนนเต็ม {fullScore}
              {isScoreItemPublished && (
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                  รายการคะแนนเผยแพร่แล้ว — ต้องใส่เหตุผล
                </span>
              )}
            </p>
          )}

          <div className="mt-5 space-y-4">
            {isScored && (
              <>
                <div>
                  <label className="block text-xs font-medium text-black/70">
                    คะแนน (0..{fullScore})
                  </label>
                  <input
                    type="number"
                    name="value"
                    min={0}
                    max={fullScore ?? undefined}
                    step={1}
                    defaultValue={currentValue ?? ""}
                    className="input mt-1"
                  />
                  {state.fieldErrors?.value && (
                    <p className="mt-1 text-xs text-rose-600">
                      {state.fieldErrors.value}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/70">
                    หมายเหตุ (ตัวเอง)
                  </label>
                  <input
                    type="text"
                    name="note"
                    maxLength={200}
                    className="input mt-1"
                    placeholder="ครูเห็นเอง · ไม่แสดงให้นักเรียน"
                  />
                </div>
                {isScoreItemPublished && (
                  <div>
                    <label className="block text-xs font-medium text-black/70">
                      เหตุผลการแก้คะแนนหลังเผยแพร่{" "}
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="reason"
                      minLength={5}
                      maxLength={500}
                      required
                      className="input mt-1"
                      placeholder="≥ 5 ตัวอักษร · จะถูกบันทึก audit"
                    />
                    {state.fieldErrors?.reason && (
                      <p className="mt-1 text-xs text-rose-600">
                        {state.fieldErrors.reason}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="markGraded" className="h-4 w-4" />
              ตรวจเสร็จ (เปลี่ยนสถานะเป็น GRADED)
            </label>
          </div>

          {state.error && (
            <p className="mt-3 text-xs text-rose-600">{state.error}</p>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => dialogRef.current?.close()}
              disabled={isPending}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="btn-primary btn-sm"
              disabled={isPending}
            >
              {isPending ? "กำลังบันทึก…" : "บันทึก"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
