"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { selfDeleteCommentAction, type CommentActionState } from "./actions";

/**
 * Self-delete button — no confirmation dialog needed (author owns the
 * content, can repost anytime). For moderator deletes that need a
 * reason, see `<ModerateDeleteCommentDialog />`.
 */
export function SelfDeleteCommentButton({
  commentId,
  revalidate,
}: {
  commentId: string;
  revalidate: string;
}) {
  const [, formAction, isPending] = useActionState<
    CommentActionState,
    FormData
  >(selfDeleteCommentAction, {});

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="commentId" value={commentId} />
      <input type="hidden" name="revalidate" value={revalidate} />
      <button
        type="submit"
        className="rounded p-1 text-black/40 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
        title="ลบความคิดเห็นของฉัน"
        disabled={isPending}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </form>
  );
}
