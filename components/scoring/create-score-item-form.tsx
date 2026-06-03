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
  /** Current Σ basis points for the course — display only, the publish gate is server-side. */
  currentSumBp: number;
};

export function CreateScoreItemForm({ courseId, currentSumBp }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [fullScore, setFullScore] = useState("10");
  /** Weight stored as a "%" string in the field, converted to bp at submit. */
  const [weightPct, setWeightPct] = useState("");

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

  // Convert "12.5" → 1250 bp on submit via a hidden field that mirrors the
  // user's percent input. Two-decimal precision matches ADR-0017.
  const weightBp = (() => {
    const pct = Number.parseFloat(weightPct);
    if (!Number.isFinite(pct)) return "";
    return String(Math.round(pct * 100));
  })();

  const remainingBp = 10_000 - currentSumBp;
  const remainingPctLabel = (remainingBp / 100)
    .toFixed(2)
    .replace(/\.?0+$/, "");

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
          <input type="hidden" name="weight" value={weightBp} />

          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2
                className="text-lg font-medium text-black"
                style={{ letterSpacing: "-0.02em" }}
              >
                เพิ่มรายการคะแนน
              </h2>
              <p className="mt-1 text-sm text-black/60">
                เหลือน้ำหนัก {remainingPctLabel}% เพื่อให้ครบ 100%
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

            <div className="grid grid-cols-2 gap-3">
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
              <div>
                <label
                  htmlFor="weightPct"
                  className="mb-1.5 block text-xs font-medium text-black/60"
                >
                  น้ำหนัก (%)
                </label>
                <input
                  type="number"
                  id="weightPct"
                  required
                  min={0}
                  max={100}
                  step={0.01}
                  value={weightPct}
                  onChange={(e) => setWeightPct(e.target.value)}
                  placeholder={remainingPctLabel}
                  className="input"
                />
                {state.fieldErrors?.weight && (
                  <p className="mt-1 text-xs text-rose-600">
                    {state.fieldErrors.weight}
                  </p>
                )}
              </div>
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
