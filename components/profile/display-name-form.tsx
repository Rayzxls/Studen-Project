"use client";

import { useActionState } from "react";
import {
  updateDisplayNameAction,
  type ProfileFormState,
} from "@/app/profile/actions";

/**
 * displayName editor — Phase 13. Optional friendly name; clearing the
 * field resets back to the real-name fallback. Duplicates allowed by
 * design (it is not an identity key).
 */
export function DisplayNameForm({
  initialDisplayName,
  maxLength,
}: {
  initialDisplayName: string | null;
  maxLength: number;
}) {
  const [state, formAction, isPending] = useActionState<
    ProfileFormState,
    FormData
  >(updateDisplayNameAction, {});

  return (
    <form action={formAction} className="max-w-sm">
      <label
        htmlFor="displayName"
        className="block text-xs font-medium text-black/70"
      >
        ชื่อที่แสดง (ไม่บังคับ)
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id="displayName"
          name="displayName"
          type="text"
          maxLength={maxLength}
          defaultValue={initialDisplayName ?? ""}
          placeholder="เช่น ชื่อเล่นของคุณ"
          className="input flex-1"
        />
        <button
          type="submit"
          className="btn-secondary btn-sm shrink-0"
          disabled={isPending}
        >
          {isPending ? "กำลังบันทึก…" : "บันทึก"}
        </button>
      </div>
      <p className="mt-1.5 text-[11px] leading-4 text-black/45">
        ใช้ในคำทักทายและหน้าโปรไฟล์ของคุณเท่านั้น —
        ครูและเพื่อนร่วมห้องยังเห็นชื่อจริงเสมอ เว้นว่างเพื่อกลับไปใช้ชื่อจริง
      </p>
      {state.fieldErrors?.displayName && (
        <p className="mt-1 text-xs text-red-700">
          {state.fieldErrors.displayName}
        </p>
      )}
      {state.ok && <p className="mt-1 text-xs text-green-700">บันทึกแล้ว</p>}
    </form>
  );
}
