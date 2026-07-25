"use client";

import { useActionState } from "react";
import {
  requestAccountDeletionAction,
  type ProfileFormState,
} from "@/app/profile/actions";

/**
 * Delete-account danger zone — Release D identity (D1).
 *
 * Requires typing DELETE to confirm; on success the server moves the account to
 * Deletion Pending, signs this device out, and redirects to login, so this form
 * never shows a success state of its own. Ownership rests on the same pragmatic
 * re-auth rule as the other sensitive Profile mutations; a lapsed window comes
 * back as `state.error`.
 */
export function DeleteAccountForm() {
  const [state, formAction, isPending] = useActionState<
    ProfileFormState,
    FormData
  >(requestAccountDeletionAction, {});

  return (
    <form action={formAction} className="max-w-sm space-y-4">
      <p className="text-xs text-black/60">
        บัญชีจะถูกกำหนดให้ลบและออกจากระบบทันที คุณกู้คืนได้ภายใน 30 วัน
        หลังจากนั้นข้อมูลส่วนตัวจะถูกลบถาวร (ประวัติคะแนน งาน
        และการเข้าเรียนยังถูกเก็บไว้)
      </p>
      <div>
        <label
          htmlFor="delete-confirm"
          className="block text-xs font-medium text-black/70"
        >
          พิมพ์ <span className="font-mono font-semibold">DELETE</span>{" "}
          เพื่อยืนยัน
        </label>
        <input
          id="delete-confirm"
          type="text"
          name="confirm"
          required
          autoComplete="off"
          className="input mt-1"
          placeholder="DELETE"
        />
        {state.fieldErrors?.confirm && (
          <p className="mt-1 text-xs text-red-700">
            {state.fieldErrors.confirm}
          </p>
        )}
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        className="btn-sm inline-flex items-center justify-center rounded-full bg-red-600 px-4 font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
        disabled={isPending}
      >
        {isPending ? "กำลังดำเนินการ…" : "ลบบัญชีของฉัน"}
      </button>
    </form>
  );
}
