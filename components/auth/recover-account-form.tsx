"use client";

import { useActionState } from "react";
import Link from "next/link";

export type RecoverState = { error?: string };

export function RecoverAccountForm({
  email,
  action,
}: {
  email: string;
  action: (state: RecoverState, formData: FormData) => Promise<RecoverState>;
}) {
  const [state, formAction, pending] = useActionState<RecoverState, FormData>(
    action,
    {}
  );

  return (
    <div className="animate-fade-in rounded-2xl bg-white p-8 shadow-card">
      <div className="mb-6">
        <h1
          className="text-2xl font-medium text-black"
          style={{ letterSpacing: "-0.02em" }}
        >
          กู้คืนบัญชีของคุณ
        </h1>
        <p className="mt-1 text-sm text-black/60">
          บัญชีนี้ถูกกำหนดให้ลบไว้ แต่ยังกู้คืนได้ กดยืนยันเพื่อกลับมาใช้งานต่อ
        </p>
      </div>

      <div className="mb-4 rounded-xl bg-black/[0.03] px-3 py-2 text-sm">
        <span className="text-black/50">อีเมล (ยืนยันแล้ว)</span>
        <div className="font-medium text-black">{email}</div>
      </div>

      <form action={formAction} className="space-y-4">
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
          {pending ? "กำลังกู้คืน..." : "กู้คืนบัญชีและเข้าใช้งาน"}
        </button>
      </form>

      <Link
        href="/login"
        className="mt-4 inline-flex w-full justify-center text-sm text-black/50 underline-offset-2 hover:text-black hover:underline"
      >
        ไว้ภายหลัง
      </Link>
    </div>
  );
}
