"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Info, LogIn } from "lucide-react";

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

      <div
        className="mb-5 flex gap-3 rounded-xl px-4 py-3"
        style={{
          background:
            "color-mix(in srgb, var(--color-blue-500) 9%, var(--color-surface))",
          boxShadow:
            "inset 0 0 0 1px color-mix(in srgb, var(--color-blue-500) 38%, var(--color-hairline))",
          color: "var(--color-ink)",
        }}
      >
        <Info
          className="mt-0.5 h-5 w-5 shrink-0"
          style={{ color: "var(--color-blue-500)" }}
          aria-hidden="true"
        />
        <div>
          <p className="text-sm font-semibold">
            ใช้ได้เฉพาะบัญชีที่ตั้งรหัสผ่านสำรองแล้ว
          </p>
          <p
            className="mt-1 text-xs leading-relaxed"
            style={{ color: "var(--color-ink-soft)" }}
          >
            หากสมัครด้วย Google และยังไม่เคยตั้งรหัสผ่านสำรอง ให้เข้าสู่ระบบด้วย
            Google แล้วไปที่ โปรไฟล์ → ความปลอดภัย เพื่อตั้งค่าก่อน
          </p>
        </div>
      </div>

      {state.sent ? (
        <div className="space-y-3">
          <div className="rounded-xl bg-green-50 px-3 py-3 text-sm text-green-700">
            ถ้าอีเมลนี้มีบัญชีที่ตั้งรหัสผ่านสำรองไว้ เราได้ส่งลิงก์ไปแล้ว —
            กรุณาตรวจกล่องจดหมายของคุณ
          </div>
          <div className="rounded-xl border border-black/[0.08] px-3 py-3 text-xs leading-relaxed text-black/60">
            <p className="font-semibold text-black/70">ยังไม่ได้รับอีเมล?</p>
            <p className="mt-1">
              รอสักครู่และตรวจโฟลเดอร์สแปม หากเป็นบัญชี Google-only
              ให้เข้าสู่ระบบด้วย Google แล้วตั้งรหัสผ่านสำรองในหน้าโปรไฟล์ก่อน
            </p>
          </div>
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

      <div className="mt-5 border-t border-black/[0.06] pt-4">
        <Link href="/login" className="btn-ghost w-full justify-center gap-2">
          <LogIn className="h-4 w-4" aria-hidden="true" />
          กลับหน้าเข้าสู่ระบบ
        </Link>
      </div>
    </div>
  );
}
