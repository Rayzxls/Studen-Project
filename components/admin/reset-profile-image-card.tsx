"use client";

import { useActionState, useState } from "react";
import { ImageOff } from "lucide-react";
import {
  resetProfileImageAction,
  type ResetProfileImageState,
} from "@/app/admin/users/[id]/actions";

/**
 * Admin-only moderation card — clears another user's avatar back to the
 * shared default after an inline confirm. Audits
 * PROFILE_IMAGE_RESET_BY_ADMIN. Render only when the target user actually
 * has a custom avatar.
 */
export function ResetProfileImageCard({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, isPending] = useActionState<
    ResetProfileImageState,
    FormData
  >(resetProfileImageAction, {});

  if (state.ok) {
    return (
      <p className="rounded-xl bg-green-50 px-3 py-2 text-xs text-green-700">
        รีเซ็ตรูปโปรไฟล์แล้ว — ผู้ใช้กลับไปใช้รูปเริ่มต้น
      </p>
    );
  }

  return (
    <div>
      {!confirming ? (
        <button
          type="button"
          className="btn-ghost btn-sm text-red-700 hover:bg-red-50"
          onClick={() => setConfirming(true)}
        >
          <ImageOff className="h-4 w-4" aria-hidden="true" />
          รีเซ็ตรูปโปรไฟล์
        </button>
      ) : (
        <div className="rounded-xl bg-red-50/70 p-3 ring-1 ring-red-500/15">
          <p className="text-xs text-black/70">
            ลบรูปโปรไฟล์ของ {userName}? ผู้ใช้จะกลับไปใช้รูปเริ่มต้น (บันทึกลง
            Audit Log)
          </p>
          <form action={formAction} className="mt-2 flex gap-2">
            <input type="hidden" name="userId" value={userId} />
            <button
              type="submit"
              className="btn-danger btn-sm"
              disabled={isPending}
            >
              {isPending ? "กำลังรีเซ็ต…" : "ยืนยันรีเซ็ตรูป"}
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => setConfirming(false)}
              disabled={isPending}
            >
              ยกเลิก
            </button>
          </form>
          {state.error && (
            <p className="mt-2 text-xs text-red-700">{state.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
