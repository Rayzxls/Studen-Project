"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, X } from "lucide-react";
import {
  createScoreItemAction,
  type CreateScoreItemState,
} from "@/app/teacher/courses/[id]/scores/actions";

const INITIAL_STATE: CreateScoreItemState = {};

type Props = {
  courseId: string;
};

/**
 * ADR-0024 update — `weight` (basis points 0..10000) input removed. Sum-based
 * scoring uses `fullScore` directly as the per-item influence weight in the
 * course grade. Σ is informational only on the parent page (no publish gate).
 */
export function CreateScoreItemForm({ courseId }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [fullScore, setFullScore] = useState("10");

  const [state, formAction] = useActionState(
    createScoreItemAction,
    INITIAL_STATE
  );

  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();

  // Pattern 7 — defer close after action success.
  // Pattern 9 — no setState here. Form state resets the next time the
  // teacher opens the dialog by typing fresh values; the page revalidates
  // and re-renders the list immediately, so the stale form is hidden.
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
      <button type="button" onClick={open} className="btn-primary btn-sm">
        <Plus className="mr-1 inline h-4 w-4" />
        เพิ่มรายการคะแนน
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

          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2
                className="text-lg font-medium text-black"
                style={{ letterSpacing: "-0.02em" }}
              >
                เพิ่มรายการคะแนน
              </h2>
              <p className="mt-1 text-sm text-black/60">
                ตั้งชื่อ + ใส่คะแนนเต็ม —
                คะแนนเต็มที่สูงกว่าจะมีอิทธิพลต่อเกรดมากกว่าโดยอัตโนมัติ
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

          <div className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="mb-1.5 block text-xs font-medium text-black/60"
              >
                ชื่อรายการ
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น สอบกลางภาค, การบ้านสัปดาห์ 1"
                className="input"
                maxLength={200}
              />
              {state.fieldErrors?.name && (
                <p className="mt-1 text-xs text-rose-600">
                  {state.fieldErrors.name}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="fullScore"
                className="mb-1.5 block text-xs font-medium text-black/60"
              >
                คะแนนเต็ม
              </label>
              <input
                type="number"
                id="fullScore"
                name="fullScore"
                required
                min={1}
                step={1}
                value={fullScore}
                onChange={(e) => setFullScore(e.target.value)}
                className="input"
              />
              {state.fieldErrors?.fullScore && (
                <p className="mt-1 text-xs text-rose-600">
                  {state.fieldErrors.fullScore}
                </p>
              )}
            </div>

            {state.error && (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {state.error}
              </p>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              className="btn-secondary btn-sm"
            >
              ยกเลิก
            </button>
            <SubmitButton />
          </div>
        </form>
      </dialog>
    </>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "กำลังเพิ่ม…" : "เพิ่ม"}
    </button>
  );
}
