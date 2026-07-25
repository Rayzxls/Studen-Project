"use client";

import { useActionState } from "react";
import Link from "next/link";

export type RecoveryRequestState = { sent?: boolean; error?: string };

export function PasswordRecoveryRequestForm({
  action,
}: {
  action: (
    state: RecoveryRequestState,
    formData: FormData
  ) => Promise<RecoveryRequestState>;
}) {
  const [state, formAction, pending] = useActionState<
    RecoveryRequestState,
    FormData
  >(action, {});

  return (
    <div className="animate-fade-in rounded-2xl bg-white p-8 shadow-card">
      <div className="mb-6">
        <h1
          className="text-2xl font-medium text-black"
          style={{ letterSpacing: "-0.02em" }}
        >
          ลืมรหัสผ่าน?
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-black/60">
          กรอกอีเมลของบัญชี เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้ (ใช้ได้ครั้งเดียว
          หมดอายุใน 15 นาที)
        </p>
      </div>

      {state.sent ? (
        <div className="rounded-xl bg-green-50 px-3 py-3 text-sm text-green-700">
          ถ้าอีเมลนี้มีบัญชีที่ตั้งรหัสผ่านสำรองไว้ เราได้ส่งลิงก์ไปแล้ว —
          กรุณาตรวจกล่องจดหมายของคุณ
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
              อีเมล
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="input"
              placeholder="you@example.com"
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
            {pending ? "กำลังส่ง..." : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}
          </button>
        </form>
      )}

      <p className="mt-6 border-t border-black/[0.06] pt-4 text-center text-xs text-black/50">
        เข้าสู่ระบบด้วย Google อยู่แล้ว หรือยังไม่ได้ตั้งรหัสผ่านสำรอง?
        เข้าสู่ระบบด้วย Google ได้เลย หรือติดต่อผู้ดูแลระบบ
      </p>

      <Link
        href="/login"
        className="btn-ghost mt-3 w-full justify-center gap-2"
      >
        กลับหน้าเข้าสู่ระบบ
      </Link>
    </div>
  );
}
