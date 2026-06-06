"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Trash2, X, AlertTriangle } from "lucide-react";
import {
  deleteScoreItemAction,
  type DeleteScoreItemState,
} from "@/app/teacher/courses/[id]/scores/actions";

const INITIAL_STATE: DeleteScoreItemState = {};
const REASON_MIN = 5;
const REASON_MAX = 500;

type Props = {
  courseId: string;
  scoreItemId: string;
  scoreItemName: string;
  /** Drives reason gating + Critical-tier warning copy. */
  isPublished: boolean;
  /** ScoreEntry count — affects copy ("จะลบคะแนนนักเรียน X คนด้วย"). */
  entriesCount: number;
};

/**
 * Delete ScoreItem dialog.
 *
 * Pre-publish: no reason required, simple confirm.
 * Post-publish (ADR-0018 § Decision 1 escape hatch): reason ≥ 5 required,
 *   Critical-tier audit, dialog copy explicitly calls out the audit.
 */
export function DeleteScoreItemDialog({
  courseId,
  scoreItemId,
  scoreItemName,
  isPublished,
  entriesCount,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [state, formAction] = useActionState(
    deleteScoreItemAction,
    INITIAL_STATE
  );

  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();

  useEffect(() => {
    if (!state.ok) return;
    setTimeout(() => {
      const d = dialogRef.current;
      if (!d) return;
      d.close();
      d.removeAttribute("open");
    }, 0);
  }, [state.ok]);

  const reasonLen = reason.trim().length;
  const reasonValid =
    !isPublished || (reasonLen >= REASON_MIN && reasonLen <= REASON_MAX);

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="btn-ghost btn-sm text-red-700 hover:bg-red-50"
        title="ลบรายการคะแนน"
      >
        <Trash2 className="h-3.5 w-3.5" />
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
                ลบรายการคะแนน
              </h2>
              <p className="mt-1 text-sm text-black/60">
                &ldquo;{scoreItemName}&rdquo;
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

          {entriesCount > 0 && (
            <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
              <Trash2 className="mr-1 inline h-3.5 w-3.5" />
              คะแนนที่กรอกไว้ {entriesCount} คนจะถูกลบไปด้วย —
              การกระทำนี้ย้อนกลับไม่ได้
            </p>
          )}

          {isPublished && (
            <div className="mb-4 flex items-start gap-2 rounded-xl bg-orange-50 px-3 py-2 text-xs text-orange-700 ring-1 ring-orange-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">รายการนี้เผยแพร่แล้ว</p>
                <p className="mt-0.5">
                  การลบหลังเผยแพร่จะถูกบันทึก audit ระดับ Critical
                  พร้อมเหตุผลที่ระบุด้านล่าง (ขั้นต่ำ {REASON_MIN} ตัวอักษร)
                </p>
              </div>
            </div>
          )}

          {isPublished && (
            <div className="mb-4">
              <label
                htmlFor="reason"
                className="mb-1.5 block text-xs font-medium text-black/60"
              >
                เหตุผลในการลบ (จำเป็น)
              </label>
              <textarea
                id="reason"
                name="reason"
                rows={3}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="เช่น รายการซ้ำ, ตัดสินใจไม่ใช้ในเทอมนี้"
                className="input resize-none"
              />
              <div className="mt-1 flex items-center justify-between text-xs">
                <span
                  className={
                    reasonLen > 0 && reasonLen < REASON_MIN
                      ? "text-red-700"
                      : "text-black/40"
                  }
                >
                  {reasonLen > 0 && reasonLen < REASON_MIN
                    ? `ขั้นต่ำ ${REASON_MIN} ตัวอักษร`
                    : `${REASON_MIN}–${REASON_MAX} ตัวอักษร · จะบันทึก audit`}
                </span>
                <span
                  className={
                    reasonLen > REASON_MAX
                      ? "font-medium text-red-700"
                      : "text-black/40"
                  }
                >
                  {reasonLen}/{REASON_MAX}
                </span>
              </div>
              {state.fieldErrors?.reason && (
                <p className="mt-1 text-xs text-red-700">
                  {state.fieldErrors.reason}
                </p>
              )}
            </div>
          )}

          {!isPublished && <input type="hidden" name="reason" value="" />}

          {state.error && (
            <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
              {state.error}
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
            <SubmitButton disabled={!reasonValid} />
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
      className="btn-danger btn-sm disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "กำลังลบ…" : "ยืนยันลบ"}
    </button>
  );
}
