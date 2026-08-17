"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { RotateCcw, X } from "lucide-react";

import {
  reverseCourseRewardAction,
  type RewardActionState,
} from "@/app/teacher/courses/[id]/rewards/actions";

const INITIAL_STATE: RewardActionState = {};

export function ReverseRewardDialog({
  courseId,
  entryId,
  points,
  studentName,
}: {
  courseId: string;
  entryId: string;
  points: number;
  studentName: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction] = useActionState(
    reverseCourseRewardAction,
    INITIAL_STATE
  );

  useEffect(() => {
    if (!state.ok) return;
    setTimeout(() => dialogRef.current?.close(), 0);
  }, [state.ok]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="cursor-pointer rounded-lg px-2 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
      >
        ย้อนแต้ม
      </button>
      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-md rounded-3xl bg-white p-0 shadow-lift backdrop:bg-black/45 backdrop:backdrop-blur-sm"
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <form action={formAction} className="p-6">
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name="entryId" value={entryId} />
          <header className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-black">
                ย้อนรายการ {points} แต้ม
              </h2>
              <p className="mt-1 text-sm text-black/55">
                ระบบจะเพิ่มรายการหักกลับให้ {studentName} โดยไม่ลบประวัติเดิม
              </p>
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="ปิด"
              className="cursor-pointer rounded-full p-2 text-black/40 hover:bg-black/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <label
            htmlFor={`reverse-reason-${entryId}`}
            className="mb-1.5 mt-5 block text-xs font-semibold text-black/60"
          >
            เหตุผล (นักเรียนจะเห็น)
          </label>
          <textarea
            id={`reverse-reason-${entryId}`}
            name="reason"
            rows={3}
            minLength={5}
            maxLength={500}
            required
            placeholder="เช่น บันทึกการเข้าเรียนผิดวัน"
            className="input resize-none"
          />
          {state.fieldErrors?.reason && (
            <p className="mt-1 text-xs text-red-700">
              {state.fieldErrors.reason}
            </p>
          )}
          {(state.error || state.fieldErrors?.reward) && (
            <p
              role="alert"
              className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              {state.error ?? state.fieldErrors?.reward}
            </p>
          )}

          <footer className="mt-6 flex justify-end gap-2 border-t border-black/[0.06] pt-5">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="btn-secondary btn-sm cursor-pointer"
            >
              ยกเลิก
            </button>
            <ReverseSubmitButton />
          </footer>
        </form>
      </dialog>
    </>
  );
}

function ReverseSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-danger btn-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
    >
      <RotateCcw className="h-4 w-4" aria-hidden="true" />
      {pending ? "กำลังย้อน…" : "ยืนยันย้อนแต้ม"}
    </button>
  );
}
