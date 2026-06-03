"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { X } from "lucide-react";
import {
  removeMemberAction,
  type RemoveMemberState,
} from "@/app/teacher/courses/[id]/members/actions";

const REASON_MIN = 5;
const REASON_MAX = 500;
const INITIAL_STATE: RemoveMemberState = {};

type Props = {
  courseId: string;
  enrollmentId: string;
  studentName: string;
  studentIdNumber: string;
};

export function RemoveMemberDialog({
  courseId,
  enrollmentId,
  studentName,
  studentIdNumber,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");

  const boundAction = removeMemberAction.bind(null, courseId);
  const [state, formAction] = useActionState(boundAction, INITIAL_STATE);

  // Close dialog on success. We deliberately do NOT reset `reason` here:
  // (a) React 19's `set-state-in-effect` rule discourages it, and
  // (b) on success the row vanishes from the table after revalidation,
  //     so this dialog instance will never re-open. Per-row state isolation
  //     means each Members table row has its own component + own state.
  //
  // The setTimeout + removeAttribute belt-and-braces is needed because
  // calling close() synchronously inside the same commit cycle as the
  // Server Action result sometimes doesn't take under Next 16 + React 19
  // + Turbopack — the dialog stays visible despite the action succeeding.
  useEffect(() => {
    if (!state.ok) return;
    setTimeout(() => {
      const d = dialogRef.current;
      if (!d) return;
      d.close();
      d.removeAttribute("open");
    }, 0);
  }, [state.ok]);

  const open = () => dialogRef.current?.showModal();
  const close = () => {
    dialogRef.current?.close();
    setReason("");
  };

  const trimmedLen = reason.trim().length;
  const tooShort = trimmedLen > 0 && trimmedLen < REASON_MIN;
  const tooLong = trimmedLen > REASON_MAX;
  const canSubmit = trimmedLen >= REASON_MIN && trimmedLen <= REASON_MAX;

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="text-sm text-rose-600 transition-colors hover:text-rose-700"
      >
        นำออก
      </button>

      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 shadow-lift backdrop:bg-black/40 backdrop:backdrop-blur-sm"
        onClick={(e) => {
          // close on backdrop click
          if (e.target === dialogRef.current) close();
        }}
      >
        <form action={formAction} className="p-6">
          <input type="hidden" name="enrollmentId" value={enrollmentId} />

          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2
                className="text-lg font-medium text-black"
                style={{ letterSpacing: "-0.02em" }}
              >
                นำนักเรียนออกจากห้อง
              </h2>
              <p className="mt-1 text-sm text-black/60">
                {studentName}{" "}
                <span className="font-mono text-xs">({studentIdNumber})</span>
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

          <div className="rounded-xl bg-black/[0.04] p-3 text-xs text-black/70">
            คะแนนและงานส่งจะถูกเก็บไว้ (soft-delete). ถ้านักเรียนใช้รหัสห้องเดิม
            join อีก จะกลับเข้าห้องอัตโนมัติ — ถ้าต้องการป้องกัน
            ปิดรหัสห้องในแท็บ &ldquo;ตั้งค่า&rdquo;
          </div>

          <div className="mt-4">
            <label
              htmlFor="reason"
              className="mb-1.5 block text-xs font-medium text-black/60"
            >
              เหตุผล (จำเป็น)
            </label>
            <textarea
              id="reason"
              name="reason"
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น ย้ายไปห้องอื่น, ออกจากวิชา"
              className="input resize-none"
              aria-invalid={tooShort || tooLong || undefined}
            />
            <div className="mt-1 flex items-center justify-between text-xs">
              <span
                className={
                  tooShort || tooLong ? "text-rose-600" : "text-black/40"
                }
              >
                {tooShort
                  ? `ขั้นต่ำ ${REASON_MIN} ตัวอักษร`
                  : tooLong
                    ? `เกิน ${REASON_MAX} ตัวอักษร`
                    : `${REASON_MIN}–${REASON_MAX} ตัวอักษร · จะบันทึกใน audit log`}
              </span>
              <span
                className={
                  tooLong ? "font-medium text-rose-600" : "text-black/40"
                }
              >
                {trimmedLen}/{REASON_MAX}
              </span>
            </div>
            {state.fieldErrors?.reason && (
              <p className="mt-1 text-xs text-rose-600">
                {state.fieldErrors.reason}
              </p>
            )}
          </div>

          {state.error && (
            <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {state.error}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              className="btn-secondary btn-sm"
            >
              ยกเลิก
            </button>
            <SubmitButton disabled={!canSubmit} />
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
      className="btn-danger btn-sm disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "กำลังนำออก…" : "นำออก"}
    </button>
  );
}
