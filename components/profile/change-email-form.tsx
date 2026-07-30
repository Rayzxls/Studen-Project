"use client";

import { useActionState } from "react";

import {
  requestEmailChangeAction,
  type ProfileFormState,
} from "@/app/profile/actions";

export function ChangeEmailForm({
  currentEmail,
}: {
  currentEmail: string | null;
}) {
  const [state, formAction, pending] = useActionState<
    ProfileFormState,
    FormData
  >(requestEmailChangeAction, {});

  if (state.ok) {
    return (
      <div className="rounded-xl bg-green-50 px-3 py-3 text-sm text-green-700">
        ส่งลิงก์ยืนยันไปที่อีเมลนั้นแล้ว — เปิดลิงก์ในกล่องจดหมายเพื่อยืนยัน
        (ใช้ได้ครั้งเดียว หมดอายุใน 15 นาที)
        เมื่อยืนยันสำเร็จอุปกรณ์อื่นจะถูกออกจากระบบทั้งหมด
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      {currentEmail && (
        <div className="text-xs text-black/50">
          อีเมลปัจจุบัน:{" "}
          <span className="font-mono text-black/70">{currentEmail}</span>
        </div>
      )}
      <div>
        <label htmlFor="newEmail" className="mb-1.5 block text-sm font-medium">
          {currentEmail ? "อีเมลใหม่" : "อีเมล"}
        </label>
        <input
          id="newEmail"
          name="newEmail"
          type="email"
          autoComplete="off"
          required
          className="input"
          placeholder="new@example.com"
        />
        {state.fieldErrors?.newEmail && (
          <p className="mt-1 text-xs text-red-700">
            {state.fieldErrors.newEmail}
          </p>
        )}
      </div>

      {state.error && (
        <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <button type="submit" disabled={pending} className="btn-secondary btn-sm">
        {pending
          ? "กำลังส่ง..."
          : currentEmail
            ? "ส่งลิงก์ยืนยันอีเมลใหม่"
            : "ส่งลิงก์ยืนยันอีเมล"}
      </button>
    </form>
  );
}
