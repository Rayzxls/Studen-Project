"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Archive, X } from "lucide-react";
import {
  archiveCourseAction,
  type ArchiveCourseState,
} from "@/app/teacher/courses/[id]/settings/actions";

const REASON_MIN = 5;
const REASON_MAX = 500;
const INITIAL_STATE: ArchiveCourseState = {};

type Props = {
  courseId: string;
  courseName: string;
};

export function ArchiveCourseDialog({ courseId, courseName }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [state, formAction] = useActionState(
    archiveCourseAction,
    INITIAL_STATE
  );

  useEffect(() => {
    if (!state.ok) return;
    dialogRef.current?.close();
    router.replace("/teacher/courses");
    router.refresh();
  }, [router, state.ok]);

  const close = () => {
    dialogRef.current?.close();
    setReason("");
  };
  const trimmedLen = reason.trim().length;
  const tooShort = trimmedLen > 0 && trimmedLen < REASON_MIN;
  const tooLong = trimmedLen > REASON_MAX;
  const canSubmit = trimmedLen >= REASON_MIN && trimmedLen <= REASON_MAX;

  return (
    <div className="card border-red-100 bg-red-50/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-xl bg-white text-red-700 shadow-sm ring-1 ring-red-100">
            <Archive className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold text-black">ยกเลิกวิชา</h2>
            <p className="mt-1 max-w-xl text-sm text-black/60">
              ใช้เมื่อจบภาคเรียนหรือไม่ต้องการเปิด Classroom นี้แล้ว
              ระบบจะซ่อนวิชาจาก Dashboard และปิดรหัสเข้าห้องทันที โดยไม่ลบคะแนน
              งานส่ง หรือประวัติการเข้าเรียน
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          className="btn-danger btn-sm"
        >
          ยกเลิกวิชา
        </button>
      </div>

      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 shadow-lift backdrop:bg-black/40 backdrop:backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
      >
        <form action={formAction} className="p-6">
          <input type="hidden" name="courseId" value={courseId} />

          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-black">
                ยืนยันยกเลิกวิชา
              </h2>
              <p className="mt-1 text-sm text-black/60">{courseName}</p>
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
            หลังยืนยัน นักเรียนจะไม่เห็นวิชานี้ในรายการหลัก
            ครูจะกลับไปหน้าวิชาที่สอน และรหัสห้องจะถูกปิดเพื่อกันการเข้าร่วมใหม่
          </div>

          <div className="mt-4">
            <label
              htmlFor="archive_reason"
              className="mb-1.5 block text-xs font-medium text-black/60"
            >
              เหตุผล (จำเป็น)
            </label>
            <textarea
              id="archive_reason"
              name="reason"
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น จบภาคเรียนแล้ว, ปิดรายวิชานี้"
              className="input resize-none"
              aria-invalid={tooShort || tooLong || undefined}
            />
            <div className="mt-1 flex items-center justify-between text-xs">
              <span
                className={
                  tooShort || tooLong ? "text-red-700" : "text-black/40"
                }
              >
                {tooShort
                  ? `ขั้นต่ำ ${REASON_MIN} ตัวอักษร`
                  : tooLong
                    ? `เกิน ${REASON_MAX} ตัวอักษร`
                    : `${REASON_MIN}-${REASON_MAX} ตัวอักษร`}
              </span>
              <span className={tooLong ? "text-red-700" : "text-black/40"}>
                {trimmedLen}/{REASON_MAX}
              </span>
            </div>
            {state.fieldErrors?.reason && (
              <p className="mt-1 text-xs text-red-700">
                {state.fieldErrors.reason}
              </p>
            )}
          </div>

          {state.error && (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
              {state.error}
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
    </div>
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
      {pending ? "กำลังยกเลิกวิชา..." : "ยืนยันยกเลิกวิชา"}
    </button>
  );
}
