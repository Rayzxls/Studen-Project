"use client";

import { useActionState, useEffect, useRef } from "react";
import type { CommentOwnerType, CommentScope } from "@prisma/client";
import { createCommentAction, type CommentActionState } from "./actions";

/**
 * Comment composer — client island next to the server-rendered thread.
 * Uses `useActionState` so Pattern 9 (avoid setState-in-effect) holds:
 * we reset the textarea by remounting it on the `state.ok` flip via the
 * `key` prop, no manual state poke.
 */
export function CommentComposer({
  ownerType,
  ownerId,
  scope,
  revalidate,
  placeholder,
}: {
  ownerType: CommentOwnerType;
  ownerId: string;
  scope: CommentScope;
  revalidate: string;
  placeholder?: string;
}) {
  const [state, formAction, isPending] = useActionState<
    CommentActionState,
    FormData
  >(createCommentAction, {});
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="ownerType" value={ownerType} />
      <input type="hidden" name="ownerId" value={ownerId} />
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="revalidate" value={revalidate} />
      <textarea
        name="body"
        required
        minLength={1}
        maxLength={2000}
        rows={2}
        className="input"
        placeholder={placeholder ?? "เขียนความคิดเห็น…"}
      />
      {state.fieldErrors?.body && (
        <p className="text-xs text-rose-600">{state.fieldErrors.body}</p>
      )}
      {state.error && <p className="text-xs text-rose-600">{state.error}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          className="btn-primary btn-sm"
          disabled={isPending}
        >
          {isPending ? "กำลังโพสต์…" : "โพสต์ความคิดเห็น"}
        </button>
      </div>
    </form>
  );
}
