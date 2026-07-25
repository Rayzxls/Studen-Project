"use client";

import { useActionState } from "react";

export type SetNewPasswordState = { error?: string };

export function SetNewPasswordForm({
  token,
  action,
}: {
  token: string;
  action: (
    state: SetNewPasswordState,
    formData: FormData
  ) => Promise<SetNewPasswordState>;
}) {
  const [state, formAction, pending] = useActionState<
    SetNewPasswordState,
    FormData
  >(action, {});

  return (
    <div className="animate-fade-in rounded-2xl bg-white p-8 shadow-card">
      <div className="mb-6">
        <h1
          className="text-2xl font-medium text-black"
          style={{ letterSpacing: "-0.02em" }}
        >
          ตั้งรหัสผ่านใหม่
        </h1>
        <p className="mt-1 text-sm text-black/60">
          ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ
          เมื่อสำเร็จอุปกรณ์อื่นจะถูกออกจากระบบทั้งหมด
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-medium"
          >
            รหัสผ่านใหม่
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            className="input"
            placeholder="••••••••"
          />
        </div>
        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-1.5 block text-sm font-medium"
          >
            ยืนยันรหัสผ่านใหม่
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            className="input"
            placeholder="••••••••"
          />
        </div>

        {state.error && (
          <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="btn-primary w-full justify-center"
        >
          {pending ? "กำลังบันทึก..." : "ตั้งรหัสผ่านใหม่"}
        </button>
      </form>
    </div>
  );
}
