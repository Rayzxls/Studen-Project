"use client";

import { useActionState } from "react";
import {
  changePasswordAction,
  type ProfileFormState,
} from "@/app/profile/actions";

/**
 * Change-own-password form — Phase 13 · Profile § ความปลอดภัย.
 * Routes through lib/auth/change-password (verify current → validate →
 * PASSWORD_CHANGED_SELF audit). Other devices stay logged in (phase 1).
 */
export function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState<
    ProfileFormState,
    FormData
  >(changePasswordAction, {});

  return (
    <form action={formAction} className="max-w-sm space-y-4">
      <Field
        name="currentPassword"
        label="รหัสผ่านปัจจุบัน"
        autoComplete="current-password"
        error={state.fieldErrors?.currentPassword}
      />
      <Field
        name="newPassword"
        label="รหัสผ่านใหม่"
        autoComplete="new-password"
        error={state.fieldErrors?.newPassword}
      />
      <Field
        name="confirmPassword"
        label="ยืนยันรหัสผ่านใหม่"
        autoComplete="new-password"
        error={state.fieldErrors?.confirmPassword}
      />

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">
          เปลี่ยนรหัสผ่านเรียบร้อยแล้ว
        </p>
      )}

      <button type="submit" className="btn-primary btn-sm" disabled={isPending}>
        {isPending ? "กำลังบันทึก…" : "เปลี่ยนรหัสผ่าน"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  autoComplete,
  error,
}: {
  name: string;
  label: string;
  autoComplete: string;
  error?: string;
}) {
  return (
    <div>
      <label
        htmlFor={`pw-${name}`}
        className="block text-xs font-medium text-black/70"
      >
        {label}
      </label>
      <input
        id={`pw-${name}`}
        type="password"
        name={name}
        required
        autoComplete={autoComplete}
        className="input mt-1"
      />
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
