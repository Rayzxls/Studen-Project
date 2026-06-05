"use client";

import { useActionState, useEffect, useRef } from "react";
import { Pencil } from "lucide-react";
import { editCommentAction, type CommentActionState } from "./actions";

/**
 * Self-edit dialog — only mounted when the row is still within the
 * 5-min window (the row Server Component does that check up-front and
 * gates rendering). The lib re-checks server-side before applying.
 */
export function EditCommentDialog({
  commentId,
  initialBody,
  revalidate,
}: {
  commentId: string;
  initialBody: string;
  revalidate: string;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [state, formAction, isPending] = useActionState<
    CommentActionState,
    FormData
  >(editCommentAction, {});

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
        className="rounded p-1 text-black/40 hover:bg-black/[0.05] hover:text-black"
        title="แก้ไข"
        onClick={() => dialogRef.current?.showModal()}
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-md rounded-2xl border border-black/10 bg-white p-0 shadow-soft backdrop:bg-black/40"
      >
        <form action={formAction} className="p-6">
          <input type="hidden" name="commentId" value={commentId} />
          <input type="hidden" name="revalidate" value={revalidate} />
          <h3 className="text-base font-medium text-black">แก้ไขความคิดเห็น</h3>
          <p className="mt-0.5 text-xs text-black/50">
            แก้ได้ภายใน 5 นาทีหลังโพสต์
          </p>
          <textarea
            name="body"
            required
            minLength={1}
            maxLength={2000}
            rows={3}
            defaultValue={initialBody}
            className="input mt-3"
          />
          {state.fieldErrors?.body && (
            <p className="mt-1 text-xs text-rose-600">
              {state.fieldErrors.body}
            </p>
          )}
          {state.error && (
            <p className="mt-1 text-xs text-rose-600">{state.error}</p>
          )}
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
