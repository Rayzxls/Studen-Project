"use client";

import { useActionState } from "react";
import Link from "next/link";

export type GoogleOnboardingState = { error?: string };

export function GoogleOnboardingForm({
  email,
  action,
}: {
  email: string;
  action: (
    state: GoogleOnboardingState,
    formData: FormData
  ) => Promise<GoogleOnboardingState>;
}) {
  const [state, formAction, pending] = useActionState<
    GoogleOnboardingState,
    FormData
  >(action, {});

  return (
    <div className="animate-fade-in rounded-2xl bg-white p-8 shadow-card">
      <div className="mb-6">
        <h1
          className="text-2xl font-medium text-black"
          style={{ letterSpacing: "-0.02em" }}
        >
          ตั้งค่าบัญชีของคุณ
        </h1>
        <p className="mt-1 text-sm text-black/60">
          ยืนยันตัวตนด้วย Google แล้ว — กรอกชื่อจริงเพื่อใช้ในห้องเรียน
        </p>
      </div>

      <div className="mb-4 rounded-xl bg-black/[0.03] px-3 py-2 text-sm">
        <span className="text-black/50">อีเมล (ยืนยันแล้ว)</span>
        <div className="font-medium text-black">{email}</div>
      </div>

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
          {pending ? "กำลังสร้างบัญชี..." : "สร้างบัญชีและเข้าใช้งาน"}
        </button>
      </form>
    </div>
  );
}
