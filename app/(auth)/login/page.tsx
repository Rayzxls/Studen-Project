"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginAction, type LoginState } from "./actions";
import {
  GoogleSignInButton,
  googleSignInEnabled,
} from "@/components/auth/google-sign-in-button";

const initial: LoginState = {};

function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);
  const search = useSearchParams();
  const resetSuccess = search.get("reset") === "success";
  const onboarded = search.get("onboarded") === "1";
  const consentRefresh = search.get("error") === "consent_refresh";

  return (
    <div className="animate-fade-in rounded-2xl bg-white p-8 shadow-card">
      <div className="mb-6">
        <h1
          className="text-2xl font-medium text-black"
          style={{ letterSpacing: "-0.02em" }}
        >
          เข้าสู่ระบบ
        </h1>
        <p className="mt-1 text-sm text-black/60">
          เข้าใช้งานระบบจัดการห้องเรียน
        </p>
      </div>

      {resetSuccess && (
        <div className="mb-4 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">
          เปลี่ยนรหัสผ่านสำเร็จ — กรุณาเข้าสู่ระบบด้วยรหัสใหม่
        </div>
      )}

      {onboarded && (
        <div className="mb-4 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">
          สร้างบัญชีสำเร็จ — เข้าสู่ระบบด้วย Google อีกครั้งเพื่อเริ่มใช้งาน
        </div>
      )}

      {consentRefresh && (
        <div className="mb-4 rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-700">
          มีข้อกำหนดฉบับใหม่ที่ต้องยอมรับก่อน กรุณาติดต่อผู้ดูแลระบบ
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
              className="text-xs text-black/60 underline-offset-2 hover:text-black hover:underline"
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
          <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
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

        <div className="border-t border-black/[0.06] pt-4 text-center text-sm text-black/60">
          ยังไม่มีบัญชี (นักเรียน)?{" "}
          <Link
            href="/signup"
            className="font-medium text-black underline-offset-2 hover:underline"
          >
            สมัครสมาชิก
          </Link>
        </div>
      </form>

      {googleSignInEnabled() && (
        <div className="mt-4">
          <div className="relative my-4 text-center">
            <span className="relative z-10 bg-white px-3 text-xs text-black/40">
              หรือ
            </span>
            <span
              aria-hidden
              className="absolute inset-x-0 top-1/2 border-t border-black/[0.06]"
            />
          </div>
          <GoogleSignInButton />
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="rounded-2xl bg-white p-8" />}>
      <LoginForm />
    </Suspense>
  );
}
