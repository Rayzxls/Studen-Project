"use client";

import { useActionState } from "react";
import Link from "next/link";

import {
  signupWithEmailAction,
  type SignupState,
} from "@/app/(auth)/signup/actions";

export function EmailSignupForm() {
  const [state, formAction, pending] = useActionState<SignupState, FormData>(
    signupWithEmailAction,
    {}
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="firstName"
            className="mb-1.5 block text-sm font-medium"
          >
            ชื่อจริง
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            autoComplete="given-name"
            required
            maxLength={100}
            className="input"
            placeholder="สมชาย"
          />
        </div>
        <div>
          <label
            htmlFor="lastName"
            className="mb-1.5 block text-sm font-medium"
          >
            นามสกุล
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            autoComplete="family-name"
            required
            maxLength={100}
            className="input"
            placeholder="ใจดี"
          />
        </div>
      </div>

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
        {state.fieldErrors?.email && (
          <p className="mt-1 text-xs text-red-700">{state.fieldErrors.email}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          รหัสผ่าน
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className="input"
          placeholder="อย่างน้อย 8 ตัวอักษร"
        />
        {state.fieldErrors?.password && (
          <p className="mt-1 text-xs text-red-700">
            {state.fieldErrors.password}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="mb-1.5 block text-sm font-medium"
        >
          ยืนยันรหัสผ่าน
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
        {state.fieldErrors?.confirmPassword && (
          <p className="mt-1 text-xs text-red-700">
            {state.fieldErrors.confirmPassword}
          </p>
        )}
      </div>

      <label className="flex items-start gap-2.5 text-sm text-black/70">
        <input
          name="acceptedConsent"
          type="checkbox"
          required
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span>
          ฉันยอมรับ
          <Link
            href="/privacy"
            className="mx-1 font-medium text-black underline-offset-2 hover:underline"
          >
            ข้อกำหนดการใช้งานและนโยบายความเป็นส่วนตัว
          </Link>
        </span>
      </label>
      {state.fieldErrors?.consent && (
        <p className="text-xs text-red-700">{state.fieldErrors.consent}</p>
      )}

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
        {pending ? "กำลังสมัคร..." : "สมัครสมาชิก"}
      </button>
    </form>
  );
}
