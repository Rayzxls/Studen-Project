"use client";

import { useActionState } from "react";
import {
  setFallbackPasswordAction,
  type ProfileFormState,
} from "@/app/profile/actions";

/**
 * Set-fallback-password form — Release D identity.
 *
 * Shown only to a Google-first account that has no password yet, so it collects
 * a new password without a current one. Ownership is proven by the pragmatic
 * re-auth rule (a recent sign-in); the server re-checks the window and reports
 * `state.error` when it has lapsed.
 */
export function SetFallbackPasswordForm() {
  const [state, formAction, isPending] = useActionState<
    ProfileFormState,
    FormData
  >(setFallbackPasswordAction, {});

  return (
    <form action={formAction} className="max-w-sm space-y-4">
      <Field
        name="newPassword"
        label="รหัสผ่านสำรอง"
        error={state.fieldErrors?.newPassword}
      />
      <Field
        name="confirmPassword"
        label="ยืนยันรหัสผ่านสำรอง"
        error={state.fieldErrors?.confirmPassword}
      />

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">
          ตั้งรหัสผ่านสำรองเรียบร้อยแล้ว — ตอนนี้เข้าสู่ระบบด้วยอีเมลและใช้ระบบ
          กู้รหัสผ่านได้แล้ว
        </p>
      )}

      <button type="submit" className="btn-primary btn-sm" disabled={isPending}>
        {isPending ? "กำลังบันทึก…" : "ตั้งรหัสผ่านสำรอง"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  error,
}: {
  name: string;
  label: string;
  error?: string;
}) {
  return (
    <div>
      <label
        htmlFor={`fpw-${name}`}
        className="block text-xs font-medium text-black/70"
      >
        {label}
      </label>
      <input
        id={`fpw-${name}`}
        type="password"
        name={name}
        required
        minLength={8}
        autoComplete="new-password"
        className="input mt-1"
      />
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
