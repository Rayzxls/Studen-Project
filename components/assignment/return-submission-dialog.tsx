"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  returnSubmissionAction,
  type ReturnSubmissionState,
} from "@/app/teacher/courses/[id]/assignments/[assignmentId]/actions";

/**
 * Return submission dialog — Pattern 7 native <dialog>.
 *
 * Teacher writes a private comment (≥ 5 chars) that doubles as the
 * SUBMISSION_RETURNED audit reason per ADR-0020 § 4 — one place to
 * write, one place to read.
 */
export function ReturnSubmissionDialog({
  courseId,
  assignmentId,
  submissionId,
  studentName,
}: {
  courseId: string;
  assignmentId: string;
  submissionId: string;
  studentName: string;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [state, formAction, isPending] = useActionState<
    ReturnSubmissionState,
    FormData
  >(returnSubmissionAction, {});

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
        className="btn-ghost btn-sm text-red-700 hover:bg-red-50"
        onClick={() => dialogRef.current?.showModal()}
      >
        ส่งคืน
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
            ส่งคืนงาน — {studentName}
          </h3>
          <p className="mt-0.5 text-xs text-black/50">
            ข้อความนี้จะเป็น private comment ใต้ submission + บันทึก audit
            (SUBMISSION_RETURNED · reason = comment ≥ 5 ตัวอักษร)
          </p>

          <div className="mt-5">
            <label className="block text-xs font-medium text-black/70">
              เหตุผล / สิ่งที่ให้แก้ <span className="text-red-500">*</span>
            </label>
            <textarea
              name="comment"
              rows={4}
              minLength={5}
              maxLength={500}
              required
              className="input mt-1"
              placeholder="เช่น 'เพิ่มเหตุผลในข้อ 2 หน่อยครับ' · ≥ 5 ตัวอักษร"
            />
            {state.fieldErrors?.comment && (
              <p className="mt-1 text-xs text-red-700">
                {state.fieldErrors.comment}
              </p>
            )}
          </div>

          {state.error && (
            <p className="mt-3 text-xs text-red-700">{state.error}</p>
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
              className="btn-danger btn-sm"
              disabled={isPending}
            >
              {isPending ? "กำลังส่งคืน…" : "ส่งคืน"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
