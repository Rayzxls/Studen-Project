"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  deleteAnnouncementAction,
  type DeleteAnnouncementState,
} from "@/app/teacher/courses/[id]/announcements/actions";

export function DeleteAnnouncementDialog({
  courseId,
  announcementId,
}: {
  courseId: string;
  announcementId: string;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    DeleteAnnouncementState,
    FormData
  >(deleteAnnouncementAction, {});

  useEffect(() => {
    if (!state.ok) return;
    setTimeout(() => {
      const d = dialogRef.current;
      if (!d) return;
      d.close();
      d.removeAttribute("open");
      router.push(`/teacher/courses/${courseId}/announcements`);
    }, 0);
  }, [state.ok, router, courseId]);

  return (
    <>
      <button
        type="button"
        className="btn-ghost btn-sm text-red-700 hover:bg-red-50"
        onClick={() => dialogRef.current?.showModal()}
      >
        <Trash2 className="h-3.5 w-3.5" /> ลบ
      </button>

      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-md rounded-2xl border border-black/10 bg-white p-0 shadow-soft backdrop:bg-black/40"
      >
        <form action={formAction} className="p-6">
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name="announcementId" value={announcementId} />

          <h3 className="text-lg font-medium text-black">ลบประกาศ?</h3>
          <p className="mt-1 text-xs text-black/60">
            ประกาศจะถูกซ่อนจากนักเรียน · audit ระดับสำคัญ
          </p>

          <div className="mt-4">
            <label className="block text-xs font-medium text-black/70">
              เหตุผล <span className="text-red-500">*</span>{" "}
              <span className="text-black/40">(อย่างน้อย 5 ตัวอักษร)</span>
            </label>
            <textarea
              name="reason"
              required
              minLength={5}
              maxLength={500}
              rows={3}
              className="input mt-1"
              placeholder="เช่น ข้อมูลผิด"
            />
            {state.fieldErrors?.reason && (
              <p className="mt-1 text-xs text-red-700">
                {state.fieldErrors.reason}
              </p>
            )}
          </div>

          {state.error && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              {state.error}
            </p>
          )}

          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => dialogRef.current?.close()}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="btn-danger btn-sm"
              disabled={isPending}
            >
              {isPending ? "กำลังลบ…" : "ลบประกาศ"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
