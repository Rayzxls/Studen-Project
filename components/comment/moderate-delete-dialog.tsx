"use client";

import { useActionState, useEffect, useRef } from "react";
import { Shield } from "lucide-react";
import {
  moderateDeleteCommentAction,
  type CommentActionState,
} from "./actions";

/**
 * Moderator delete dialog — Teacher (own course) or Admin (any course).
 * Reason ≥ 5 chars required. Fires `COMMENT_MODERATED` Important audit
 * (Critical for Admin × PRIVATE per Q5 matrix).
 */
export function ModerateDeleteCommentDialog({
  commentId,
  revalidate,
}: {
  commentId: string;
  revalidate: string;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [state, formAction, isPending] = useActionState<
    CommentActionState,
    FormData
  >(moderateDeleteCommentAction, {});

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
        className="rounded p-1 text-black/40 hover:bg-orange-50 hover:text-orange-700"
        title="ลบในฐานะผู้ดูแลห้องเรียน"
        onClick={() => dialogRef.current?.showModal()}
      >
        <Shield className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-md rounded-2xl border border-black/10 bg-white p-0 shadow-soft backdrop:bg-black/40"
      >
        <form action={formAction} className="p-6">
          <input type="hidden" name="commentId" value={commentId} />
          <input type="hidden" name="revalidate" value={revalidate} />
          <h3 className="text-base font-medium text-black">
            ลบความคิดเห็น (โดยผู้ดูแล)
          </h3>
          <p className="mt-1 text-xs text-black/60">
            ความคิดเห็นจะถูกซ่อน · บันทึก audit ระดับสำคัญ
          </p>
          <div className="mt-3">
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
              placeholder="เช่น เนื้อหาไม่เหมาะสม"
            />
            {state.fieldErrors?.reason && (
              <p className="mt-1 text-xs text-red-700">
                {state.fieldErrors.reason}
              </p>
            )}
            {state.error && (
              <p className="mt-1 text-xs text-red-700">{state.error}</p>
            )}
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
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
              {isPending ? "กำลังลบ…" : "ลบ"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
