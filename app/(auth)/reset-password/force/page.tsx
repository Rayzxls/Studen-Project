"use client";

import { useActionState } from "react";
import { forceResetAction, type ForceResetState } from "./actions";

const initial: ForceResetState = {};

export default function ForceResetPage() {
  const [state, action, pending] = useActionState(forceResetAction, initial);

  return (
    <div className="animate-fade-in rounded-2xl bg-white p-8 shadow-card">
      <div className="badge mb-4 inline-flex">บังคับเปลี่ยนรหัสผ่าน</div>
      <h1
        className="text-2xl font-medium text-black"
        style={{ letterSpacing: "-0.02em" }}
      >
        ตั้งรหัสผ่านใหม่
      </h1>
      <p className="mt-1 text-sm text-black/60">
        เพื่อความปลอดภัย กรุณาเปลี่ยนรหัสผ่านก่อนใช้งานครั้งแรก
      </p>

      <form action={action} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="currentPassword"
            className="mb-1.5 block text-sm font-medium"
          >
            รหัสผ่านปัจจุบัน
          </label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            className="input"
          />
          {state.fieldErrors?.currentPassword && (
            <p className="mt-1 text-xs text-rose-600">
              {state.fieldErrors.currentPassword}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="newPassword"
            className="mb-1.5 block text-sm font-medium"
          >
            รหัสผ่านใหม่
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="input"
            placeholder="ขั้นต่ำ 8 ตัวอักษร"
          />
          {state.fieldErrors?.newPassword && (
            <p className="mt-1 text-xs text-rose-600">
              {state.fieldErrors.newPassword}
            </p>
          )}
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
          />
          {state.fieldErrors?.confirmPassword && (
            <p className="mt-1 text-xs text-rose-600">
              {state.fieldErrors.confirmPassword}
            </p>
          )}
        </div>

        {state.error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {state.error}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="btn-primary w-full justify-center"
        >
          {pending ? "กำลังเปลี่ยน..." : "ตั้งรหัสผ่านใหม่"}
        </button>
      </form>
    </div>
  );
}
