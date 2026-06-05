"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import {
  createAnnouncementAction,
  type CreateAnnouncementState,
} from "@/app/teacher/courses/[id]/announcements/actions";

/**
 * Create Announcement dialog — title is OPTIONAL (Announcement allows
 * untitled posts where the body itself is the announcement). Body is
 * REQUIRED — opposite of Material.
 */
export function CreateAnnouncementDialog({ courseId }: { courseId: string }) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [state, formAction, isPending] = useActionState<
    CreateAnnouncementState,
    FormData
  >(createAnnouncementAction, {});

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
        className="btn-primary btn-sm"
        onClick={() => dialogRef.current?.showModal()}
      >
        <Plus className="h-3.5 w-3.5" /> เพิ่มประกาศ
      </button>

      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-black/10 bg-white p-0 shadow-soft backdrop:bg-black/40"
      >
        <form action={formAction} className="p-6">
          <input type="hidden" name="courseId" value={courseId} />

          <h3 className="text-lg font-medium text-black">เพิ่มประกาศ</h3>
          <p className="mt-0.5 text-xs text-black/50">
            ประกาศจะแสดงในฟีดของนักเรียน · เปิด CLASS_WIDE comments
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-black/70">
                หัวข้อ <span className="text-black/40">(ไม่บังคับ)</span>
              </label>
              <input
                name="title"
                maxLength={200}
                className="input mt-1"
                placeholder="เช่น ปิดเรียนวันศุกร์"
              />
              {state.fieldErrors?.title && (
                <p className="mt-1 text-xs text-rose-600">
                  {state.fieldErrors.title}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-black/70">
                ข้อความประกาศ <span className="text-rose-500">*</span>
              </label>
              <textarea
                name="body"
                required
                rows={5}
                maxLength={5000}
                className="input mt-1"
                placeholder="พิมพ์ข้อความที่ต้องการประกาศ (รองรับ markdown)"
              />
              {state.fieldErrors?.body && (
                <p className="mt-1 text-xs text-rose-600">
                  {state.fieldErrors.body}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-black/70">
                ลิงก์ (1 บรรทัด = 1 ลิงก์ · สูงสุด 5 ลิงก์)
              </label>
              <textarea
                name="linkUrls"
                rows={3}
                className="input mt-1 font-mono text-xs"
                placeholder="https://example.com"
              />
              {state.fieldErrors?.linkUrls && (
                <p className="mt-1 text-xs text-rose-600">
                  {state.fieldErrors.linkUrls}
                </p>
              )}
            </div>
          </div>

          {state.error && (
            <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
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
              className="btn-primary btn-sm"
              disabled={isPending}
            >
              {isPending ? "กำลังบันทึก…" : "โพสต์ประกาศ"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
