"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginAction, type LoginState } from "./actions";

const initial: LoginState = {};

function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);
  const search = useSearchParams();
  const resetSuccess = search.get("reset") === "success";

  return (
    <div className="glass animate-slide-up rounded-2xl p-8 shadow-lift">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">เข้าสู่ระบบ</h1>
        <p className="mt-1 text-sm text-ink-soft">
          เข้าใช้งานระบบจัดการห้องเรียน
        </p>
      </div>

      {resetSuccess && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          ✓ เปลี่ยนรหัสผ่านสำเร็จ — กรุณาเข้าสู่ระบบด้วยรหัสใหม่
        </div>
      )}

      <form action={action} className="space-y-4">
        <div>
          <label
            htmlFor="identifier"
            className="mb-1.5 block text-sm font-medium"
          >
            อีเมล หรือ เลขประจำตัวนักเรียน
          </label>
          <input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            required
            className="input"
            placeholder="teacher@studennnn.local หรือ 60001"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium">
              รหัสผ่าน
            </label>
            <Link
              href="/reset-password"
              className="text-xs text-ink-soft underline-offset-2 hover:text-ink hover:underline"
            >
              ลืมรหัสผ่าน?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="input"
            placeholder="••••••••"
          />
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
          {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          {!pending && <span aria-hidden>→</span>}
        </button>

        <div className="border-t border-slate-200 pt-4 text-center text-sm text-ink-soft">
          ยังไม่มีบัญชี (นักเรียน)?{" "}
          <Link
            href="/signup"
            className="font-medium text-ink underline-offset-2 hover:underline"
          >
            สมัครสมาชิก
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="glass rounded-2xl p-8" />}>
      <LoginForm />
    </Suspense>
  );
}
