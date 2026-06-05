"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import {
  createMaterialAction,
  type CreateMaterialState,
} from "@/app/teacher/courses/[id]/materials/actions";

/**
 * Create Material dialog — Pattern 7 native `<dialog>` + Pattern 6 hidden
 * field. Verbose tier — no audit, no reason required.
 */
export function CreateMaterialDialog({ courseId }: { courseId: string }) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [state, formAction, isPending] = useActionState<
    CreateMaterialState,
    FormData
  >(createMaterialAction, {});

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
        <Plus className="h-3.5 w-3.5" /> เพิ่มเอกสาร
      </button>

      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-black/10 bg-white p-0 shadow-soft backdrop:bg-black/40"
      >
        <form action={formAction} className="p-6">
          <input type="hidden" name="courseId" value={courseId} />

          <h3 className="text-lg font-medium text-black">เพิ่มเอกสารประกอบ</h3>
          <p className="mt-0.5 text-xs text-black/50">
            ไฟล์หรือลิงก์ที่นักเรียนใช้ประกอบเรียน · ไม่มีการส่งงาน
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-black/70">
                ชื่อเอกสาร <span className="text-rose-500">*</span>
              </label>
              <input
                name="title"
                required
                maxLength={200}
                className="input mt-1"
                placeholder="เช่น สรุปบทที่ 3"
              />
              {state.fieldErrors?.title && (
                <p className="mt-1 text-xs text-rose-600">
                  {state.fieldErrors.title}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-black/70">
                รายละเอียด
              </label>
              <textarea
                name="body"
                rows={4}
                maxLength={5000}
                className="input mt-1"
                placeholder="ใส่เนื้อหา หมายเหตุ หรือคำอธิบาย (ไม่บังคับ · รองรับ markdown)"
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
                placeholder="https://example.com/sheet"
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
              {isPending ? "กำลังบันทึก…" : "เพิ่มเอกสาร"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
