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
  variant = "default",
}: {
  ownerType: CommentOwnerType;
  ownerId: string;
  scope: CommentScope;
  revalidate: string;
  placeholder?: string;
  variant?: "default" | "social";
}) {
  const [state, formAction, isPending] = useActionState<
    CommentActionState,
    FormData
  >(createCommentAction, {});
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  const isSocial = variant === "social";

  return (
    <form
      ref={formRef}
      action={formAction}
      className={isSocial ? "mt-5 space-y-3" : "mt-3 space-y-2"}
    >
      <input type="hidden" name="ownerType" value={ownerType} />
      <input type="hidden" name="ownerId" value={ownerId} />
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="revalidate" value={revalidate} />
      <textarea
        name="body"
        required
        minLength={1}
        maxLength={2000}
        rows={isSocial ? 3 : 2}
        className={
          isSocial
            ? "w-full resize-none rounded-[24px] border-0 bg-white px-5 py-4 text-sm text-black shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08),0_10px_30px_rgba(15,23,42,0.06)] placeholder:text-black/35 focus:outline-none focus:shadow-[inset_0_0_0_2px_rgba(10,132,255,0.65),0_0_0_5px_rgba(10,132,255,0.14)]"
            : "input"
        }
        placeholder={placeholder ?? "เขียนความคิดเห็น…"}
      />
      {state.fieldErrors?.body && (
        <p className="text-xs text-red-700">{state.fieldErrors.body}</p>
      )}
      {state.error && <p className="text-xs text-red-700">{state.error}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          className={
            isSocial
              ? "inline-flex items-center justify-center rounded-full bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(10,132,255,0.18)] transition hover:bg-blue-600 hover:shadow-[0_18px_40px_rgba(10,132,255,0.22)] disabled:cursor-not-allowed disabled:opacity-50"
              : "btn-primary btn-sm"
          }
          disabled={isPending}
        >
          {isPending ? "กำลังโพสต์…" : "โพสต์ความคิดเห็น"}
        </button>
      </div>
    </form>
  );
}
