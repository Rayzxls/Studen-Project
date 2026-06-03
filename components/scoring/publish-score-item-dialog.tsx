"use client";

import { useEffect, useRef } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import {
  publishScoreItemAction,
  type PublishScoreItemState,
} from "@/app/teacher/courses/[id]/scores/actions";
import { formatBasisPoints } from "@/lib/scoring/format";

const INITIAL_STATE: PublishScoreItemState = {};

type Props = {
  courseId: string;
  scoreItemId: string;
  scoreItemName: string;
  weight: number; // basis points
  fullScore: number;
  /** Number of ScoreEntry rows already filled for this item — preview only. */
  entriesCount: number;
  /** Total active enrollments in the course — denominator for the entries hint. */
  activeMemberCount: number;
  /** Current Σ basis points across all items — surfaces the publish gate. */
  currentSumBp: number;
};

/**
 * Publish confirm dialog — intentionally heavier than other confirms per
 * ADR-0018 § Negative consequences. Shows item metadata + filled-entries
 * count + Σ gate state + the one-way warning.
 *
 * The button is disabled when the publish gate would fail (currentSumBp !==
 * 10000) — server still enforces in case the snapshot is stale.
 */
export function PublishScoreItemDialog({
  courseId,
  scoreItemId,
  scoreItemName,
  weight,
  fullScore,
  entriesCount,
  activeMemberCount,
  currentSumBp,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction] = useActionState(
    publishScoreItemAction,
    INITIAL_STATE
  );

  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();

  // Pattern 7 — defer close after success. The page revalidates → list
  // re-renders with the new "เผยแพร่แล้ว" badge, no local state to reset.
  useEffect(() => {
    if (!state.ok) return;
    setTimeout(() => {
      const d = dialogRef.current;
      if (!d) return;
      d.close();
      d.removeAttribute("open");
    }, 0);
  }, [state.ok]);

  const weightSumValid = currentSumBp === 10_000;
  const weightSumLabel = formatBasisPoints(currentSumBp);

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="btn-primary btn-sm"
        disabled={!weightSumValid}
        title={
          weightSumValid ? undefined : "น้ำหนักรวมต้องเท่ากับ 100% ก่อน publish"
        }
      >
        <CheckCircle2 className="mr-1 inline h-4 w-4" />
        เผยแพร่
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
          <input type="hidden" name="scoreItemId" value={scoreItemId} />

          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2
                className="text-lg font-medium text-black"
                style={{ letterSpacing: "-0.02em" }}
              >
                เผยแพร่รายการคะแนน
              </h2>
              <p className="mt-1 text-sm text-black/60">
                ตรวจสอบรายละเอียดก่อนเผยแพร่
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

          {/* Preview card */}
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <p className="text-sm font-medium text-black">{scoreItemName}</p>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-black/50">น้ำหนัก</dt>
                <dd className="font-medium text-black">
                  {formatBasisPoints(weight)}
                </dd>
              </div>
              <div>
                <dt className="text-black/50">คะแนนเต็ม</dt>
                <dd className="font-medium text-black">{fullScore}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-black/50">กรอกคะแนนแล้ว</dt>
                <dd className="font-medium text-black">
                  {entriesCount} / {activeMemberCount} คน
                  {entriesCount < activeMemberCount && (
                    <span className="ml-1 text-amber-700">
                      (คนที่ยังไม่กรอกจะถูกนับเป็น 0)
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {/* Σ pill */}
          <div className="mb-4">
            <span
              className={
                weightSumValid
                  ? "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200"
                  : "inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 ring-1 ring-rose-200"
              }
            >
              Σ น้ำหนัก = {weightSumLabel}
              {weightSumValid ? " ✓" : " — ต้องเท่ากับ 100%"}
            </span>
          </div>

          {/* One-way warning */}
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">การเผยแพร่ทำได้ครั้งเดียว</p>
              <p className="mt-0.5">
                หลังจากเผยแพร่ไม่สามารถยกเลิกได้
                การแก้คะแนน/น้ำหนัก/คะแนนเต็มหลังเผยแพร่
                จะต้องระบุเหตุผลและถูกบันทึก audit
                การเอารายการออกต้องลบโดยมีเหตุผล (audit Critical)
              </p>
            </div>
          </div>

          {state.error && (
            <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {state.error === "weight_sum_not_100"
                ? "น้ำหนักรวมไม่เท่ากับ 100% — กลับไปแก้ก่อน"
                : state.error === "already_published"
                  ? "รายการนี้เผยแพร่ไปแล้ว"
                  : state.error}
            </p>
          )}
          {state.fieldErrors?.weight && (
            <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {state.fieldErrors.weight}
            </p>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              className="btn-secondary btn-sm"
            >
              ยกเลิก
            </button>
            <SubmitButton disabled={!weightSumValid} />
          </div>
        </form>
      </dialog>
    </>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "กำลังเผยแพร่…" : "ยืนยันเผยแพร่"}
    </button>
  );
}
