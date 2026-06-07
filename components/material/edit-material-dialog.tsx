"use client";

import { useActionState, useEffect, useRef } from "react";
import { Pencil } from "lucide-react";
import {
  updateMaterialAction,
  type UpdateMaterialState,
} from "@/app/teacher/courses/[id]/materials/actions";

export function EditMaterialDialog({
  courseId,
  materialId,
  initialTitle,
  initialBody,
  initialLinkUrls,
}: {
  courseId: string;
  materialId: string;
  initialTitle: string;
  initialBody: string;
  initialLinkUrls: string[];
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [state, formAction, isPending] = useActionState<
    UpdateMaterialState,
    FormData
  >(updateMaterialAction, {});

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
        <Pencil className="h-3.5 w-3.5" /> แก้ไข
      </button>

      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-black/10 bg-white p-0 shadow-soft backdrop:bg-black/40"
      >
        <form action={formAction} className="p-6">
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name="materialId" value={materialId} />

          <h3 className="text-lg font-medium text-black">แก้ไขเอกสาร</h3>
          <p className="mt-0.5 text-xs text-black/50">
            แก้เนื้อหาได้ตลอด · ไม่มี audit
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-black/70">
                ชื่อเอกสาร <span className="text-red-500">*</span>
              </label>
              <input
                name="title"
                required
                maxLength={200}
                defaultValue={initialTitle}
                className="input mt-1"
              />
              {state.fieldErrors?.title && (
                <p className="mt-1 text-xs text-red-700">
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
                defaultValue={initialBody}
                className="input mt-1"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-black/70">
                ลิงก์ (1 บรรทัด = 1 ลิงก์)
              </label>
              <textarea
                name="linkUrls"
                rows={3}
                defaultValue={initialLinkUrls.join("\n")}
                className="input mt-1 font-mono text-xs"
              />
              {state.fieldErrors?.linkUrls && (
                <p className="mt-1 text-xs text-red-700">
                  {state.fieldErrors.linkUrls}
                </p>
              )}
            </div>
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
