"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { X, Ban } from "lucide-react";
import {
  cancelSessionAction,
  type CancelSessionState,
} from "@/app/teacher/courses/[id]/attendance/[sessionId]/actions";

const REASON_MIN = 5;
const REASON_MAX = 500;
const INITIAL_STATE: CancelSessionState = {};

type Props = {
  courseId: string;
  sessionId: string;
};

export function CancelSessionDialog({ courseId, sessionId }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [state, formAction] = useActionState(
    cancelSessionAction,
    INITIAL_STATE
  );

  // Pattern 7: explicit centering + defer-close. Closing synchronously after
  // a successful Server Action sometimes doesn't take under Next 16 + React
  // 19 + Turbopack; setTimeout(_, 0) + removeAttribute is the workaround.
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
        className="btn-ghost btn-sm text-rose-600 hover:text-rose-700"
      >
        <Ban className="mr-1 inline h-3.5 w-3.5" />
        ยกเลิกคาบ
      </button>

      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 shadow-lift backdrop:bg-black/40 backdrop:backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
      >
        <form action={formAction} className="p-6">
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name="sessionId" value={sessionId} />

          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2
                className="text-lg font-medium text-black"
                style={{ letterSpacing: "-0.02em" }}
              >
                ยกเลิกคาบเรียน
              </h2>
              <p className="mt-1 text-sm text-black/60">
                คาบจะถูก soft-cancel — ไม่นับใน stats
                การเช็คชื่อที่บันทึกไปแล้วยังคงอยู่
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
            จะบันทึก audit event{" "}
            <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px]">
              SESSION_CANCELLED
            </code>{" "}
            พร้อมเหตุผล
          </div>

          <div className="mt-4">
            <label
              htmlFor="cancel_reason"
              className="mb-1.5 block text-xs font-medium text-black/60"
            >
              เหตุผล (จำเป็น)
            </label>
            <textarea
              id="cancel_reason"
              name="reason"
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น ครูประชุม, นักเรียนไปทัศนศึกษา"
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
                    : `${REASON_MIN}–${REASON_MAX} ตัวอักษร`}
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
              {state.error === "already_cancelled"
                ? "คาบนี้ถูกยกเลิกไปแล้ว"
                : state.error}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              className="btn-secondary btn-sm"
            >
              กลับ
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
      {pending ? "กำลังยกเลิก…" : "ยืนยันยกเลิก"}
    </button>
  );
}
