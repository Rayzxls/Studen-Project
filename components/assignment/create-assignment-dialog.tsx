"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import {
  createAssignmentAction,
  type CreateAssignmentState,
} from "@/app/teacher/courses/[id]/assignments/actions";

/**
 * Create Assignment dialog — Pattern 7 (native `<dialog>` with explicit
 * centering + deferred close) + Pattern 6 (hidden courseId field, no
 * `.bind()`) + Pattern 8 (action is an async export from a "use server"
 * file).
 *
 * The `isScored` toggle conditionally renders fullScore (ADR-0024 removed weight)
 * fields. Per ADR-0019 § 2 there is NO system-chosen default — teacher
 * commits both numbers at create time when isScored=true.
 */
export function CreateAssignmentDialog({ courseId }: { courseId: string }) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [state, formAction, isPending] = useActionState<
    CreateAssignmentState,
    FormData
  >(createAssignmentAction, {});
  const [isScored, setIsScored] = useState(false);

  // Pattern 7 — defer close to next tick + removeAttribute as belt-and-braces.
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
        <Plus className="h-3.5 w-3.5" /> เพิ่มการบ้าน
      </button>

      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-black/10 bg-white p-0 shadow-soft backdrop:bg-black/40"
      >
        <form action={formAction} className="p-6">
          <input type="hidden" name="courseId" value={courseId} />

          <h3 className="text-lg font-medium text-black">เพิ่มการบ้าน</h3>
          <p className="mt-0.5 text-xs text-black/50">
            ตั้งค่าโจทย์ + กำหนดส่ง · ครูสามารถผูกกับรายการคะแนนได้
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-black/70">
                ชื่อการบ้าน <span className="text-rose-500">*</span>
              </label>
              <input
                name="title"
                required
                maxLength={200}
                className="input mt-1"
                placeholder="เช่น แบบฝึกหัดบทที่ 3"
              />
              {state.fieldErrors?.title && (
                <p className="mt-1 text-xs text-rose-600">
                  {state.fieldErrors.title}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-black/70">
                คำอธิบาย / โจทย์
              </label>
              <textarea
                name="description"
                rows={4}
                maxLength={10_000}
                className="input mt-1"
                placeholder="พิมพ์โจทย์ที่นี่ (รองรับ markdown)"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-black/70">
                กำหนดส่ง (ไม่ใส่ = ส่งเมื่อพร้อม)
              </label>
              <input
                type="datetime-local"
                name="dueAt"
                className="input mt-1"
              />
            </div>

            <fieldset className="rounded-lg border border-black/10 p-3">
              <legend className="px-1 text-xs font-medium text-black/70">
                ช่องทางส่ง
              </legend>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="allowText"
                    defaultChecked
                    className="h-4 w-4"
                  />
                  ข้อความ
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="allowFile"
                    defaultChecked
                    className="h-4 w-4"
                  />
                  ไฟล์
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="allowLink" className="h-4 w-4" />
                  ลิงก์
                </label>
              </div>
              <p className="mt-2 text-[10px] text-black/40">
                ต้องเลือกอย่างน้อย 1 ช่องทาง
              </p>
            </fieldset>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="autoCloseAtDue"
                className="h-4 w-4"
              />
              ปิดการส่งอัตโนมัติเมื่อถึงกำหนดส่ง
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isScored"
                checked={isScored}
                onChange={(e) => setIsScored(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="font-medium">นับคะแนน</span>
              <span className="text-xs text-black/50">
                (สร้างรายการคะแนนผูกอัตโนมัติ)
              </span>
            </label>

            {isScored && (
              <div className="rounded-lg bg-amber-50/50 p-3">
                <label className="block text-xs font-medium text-black/70">
                  คะแนนเต็ม <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  name="fullScore"
                  min={1}
                  step={1}
                  className="input mt-1"
                  placeholder="10"
                />
                <p className="mt-1 text-xs text-black/50">
                  คะแนนเต็มที่สูงกว่า = อิทธิพลในเกรดวิชามากกว่าโดยอัตโนมัติ
                  (ADR-0024)
                </p>
                {state.fieldErrors?.fullScore && (
                  <p className="mt-1 text-xs text-rose-600">
                    {state.fieldErrors.fullScore}
                  </p>
                )}
              </div>
            )}
          </div>

          {state.error && (
            <p className="mt-3 text-xs text-rose-600">{state.error}</p>
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
              className="btn-primary btn-sm"
              disabled={isPending}
            >
              {isPending ? "กำลังบันทึก…" : "สร้างการบ้าน"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
