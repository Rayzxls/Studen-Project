"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Archive, LogOut, MoreHorizontal, X } from "lucide-react";
import {
  leaveCourseAction,
  type LeaveCourseState,
} from "@/app/student/courses/[id]/overview/actions";
import {
  archiveCourseAction,
  type ArchiveCourseState,
} from "@/app/teacher/courses/[id]/settings/actions";

const REASON_MIN = 5;
const REASON_MAX = 500;

export function StudentCourseCardMenu({
  courseId,
  courseName,
}: {
  courseId: string;
  courseName: string;
}) {
  return (
    <CourseCardMenuShell
      courseId={courseId}
      courseName={courseName}
      actionLabel="ออกจากวิชา"
      confirmTitle="ยืนยันออกจากวิชา"
      confirmDescription="หลังยืนยัน วิชานี้จะหายจาก Dashboard และรายการวิชาเรียนของคุณ แต่ข้อมูลเดิมยังคงอยู่ในระบบ"
      placeholder="เช่น จบภาคเรียนแล้ว, ย้ายห้องเรียน"
      submitLabel="ยืนยันออกจากวิชา"
      pendingLabel="กำลังออกจากวิชา..."
      icon={<LogOut className="h-4 w-4" aria-hidden="true" />}
      role="student"
    />
  );
}

export function TeacherCourseCardMenu({
  courseId,
  courseName,
}: {
  courseId: string;
  courseName: string;
}) {
  return (
    <CourseCardMenuShell
      courseId={courseId}
      courseName={courseName}
      actionLabel="ยกเลิกวิชา"
      confirmTitle="ยืนยันยกเลิกวิชา"
      confirmDescription="หลังยืนยัน วิชานี้จะถูกซ่อนจาก Dashboard และรายการหลัก รหัสเข้าห้องจะถูกปิดทันที โดยไม่ลบงาน คะแนน หรือประวัติ"
      placeholder="เช่น จบภาคเรียนแล้ว, ปิดรายวิชานี้"
      submitLabel="ยืนยันยกเลิกวิชา"
      pendingLabel="กำลังยกเลิกวิชา..."
      icon={<Archive className="h-4 w-4" aria-hidden="true" />}
      role="teacher"
    />
  );
}

type CourseCardMenuShellProps = {
  courseId: string;
  courseName: string;
  actionLabel: string;
  confirmTitle: string;
  confirmDescription: string;
  placeholder: string;
  submitLabel: string;
  pendingLabel: string;
  icon: React.ReactNode;
  role: "student" | "teacher";
};

function CourseCardMenuShell({
  courseId,
  courseName,
  actionLabel,
  confirmTitle,
  confirmDescription,
  placeholder,
  submitLabel,
  pendingLabel,
  icon,
  role,
}: CourseCardMenuShellProps) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [studentState, studentFormAction] = useActionState(
    leaveCourseAction,
    {} satisfies LeaveCourseState
  );
  const [teacherState, teacherFormAction] = useActionState(
    archiveCourseAction,
    {} satisfies ArchiveCourseState
  );
  const state = role === "student" ? studentState : teacherState;
  const formAction = role === "student" ? studentFormAction : teacherFormAction;

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!state.ok) return;
    dialogRef.current?.close();
    router.replace(
      role === "student" ? "/student/courses" : "/teacher/courses"
    );
    router.refresh();
  }, [role, router, state.ok]);

  const closeDialog = () => {
    dialogRef.current?.close();
    setReason("");
  };
  const trimmedLen = reason.trim().length;
  const tooShort = trimmedLen > 0 && trimmedLen < REASON_MIN;
  const tooLong = trimmedLen > REASON_MAX;
  const canSubmit = trimmedLen >= REASON_MIN && trimmedLen <= REASON_MAX;

  return (
    <div ref={menuRef} className="relative text-left">
      <button
        type="button"
        aria-label="เมนูรายวิชา"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
        className="grid h-9 w-9 place-items-center rounded-full bg-white/85 text-black/60 shadow-sm ring-1 ring-black/[0.08] backdrop-blur transition hover:bg-white hover:text-black"
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
      </button>

      {menuOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-11 z-30 w-44 rounded-2xl bg-white p-1.5 shadow-[0_18px_44px_rgba(15,23,42,0.18)] ring-1 ring-black/[0.08]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              dialogRef.current?.showModal();
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-red-700 transition hover:bg-red-50"
          >
            {icon}
            {actionLabel}
          </button>
        </div>
      ) : null}

      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 shadow-lift backdrop:bg-black/40 backdrop:backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === dialogRef.current) closeDialog();
        }}
      >
        <form action={formAction} className="p-6">
          <input type="hidden" name="courseId" value={courseId} />

          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-black">
                {confirmTitle}
              </h2>
              <p className="mt-1 text-sm text-black/60">{courseName}</p>
            </div>
            <button
              type="button"
              onClick={closeDialog}
              aria-label="ปิด"
              className="rounded-full p-1 text-black/40 transition-colors hover:bg-black/[0.05] hover:text-black"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-xl bg-black/[0.04] p-3 text-xs text-black/70">
            {confirmDescription}
          </div>

          <div className="mt-4">
            <label
              htmlFor={`${role}_card_reason_${courseId}`}
              className="mb-1.5 block text-xs font-medium text-black/60"
            >
              เหตุผล (จำเป็น)
            </label>
            <textarea
              id={`${role}_card_reason_${courseId}`}
              name="reason"
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={placeholder}
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
              onClick={closeDialog}
              className="btn-secondary btn-sm"
            >
              กลับ
            </button>
            <SubmitButton
              disabled={!canSubmit}
              label={submitLabel}
              pendingLabel={pendingLabel}
            />
          </div>
        </form>
      </dialog>
    </div>
  );
}

function SubmitButton({
  disabled,
  label,
  pendingLabel,
}: {
  disabled: boolean;
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="btn-danger btn-sm disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
