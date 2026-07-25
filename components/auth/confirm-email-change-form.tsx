"use client";

import { useActionState } from "react";
import Link from "next/link";

export type ConfirmEmailChangeState = { done?: boolean; error?: string };

export function ConfirmEmailChangeForm({
  token,
  newEmail,
  action,
}: {
  token: string;
  newEmail: string;
  action: (
    state: ConfirmEmailChangeState,
    formData: FormData
  ) => Promise<ConfirmEmailChangeState>;
}) {
  const [state, formAction, pending] = useActionState<
    ConfirmEmailChangeState,
    FormData
  >(action, {});

  if (state.done) {
    return (
      <div className="animate-fade-in rounded-2xl bg-white p-8 shadow-card">
        <h1 className="text-2xl font-medium text-black">เปลี่ยนอีเมลสำเร็จ</h1>
        <p className="mt-2 text-sm text-black/60">
          อีเมลของบัญชีถูกเปลี่ยนเป็น{" "}
          <span className="font-medium text-black">{newEmail}</span> แล้ว —
          เพื่อความปลอดภัยอุปกรณ์อื่นถูกออกจากระบบ กรุณาเข้าสู่ระบบใหม่
        </p>
        <Link
          href="/login"
          className="btn-primary mt-5 inline-flex justify-center"
        >
          ไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in rounded-2xl bg-white p-8 shadow-card">
      <div className="mb-6">
        <h1
          className="text-2xl font-medium text-black"
          style={{ letterSpacing: "-0.02em" }}
        >
          ยืนยันอีเมลใหม่
        </h1>
        <p className="mt-1 text-sm text-black/60">
          ยืนยันเปลี่ยนอีเมลของบัญชีเป็นอีเมลนี้
        </p>
      </div>

      <div className="mb-4 rounded-xl bg-black/[0.03] px-3 py-2 text-sm">
        <span className="text-black/50">อีเมลใหม่</span>
        <div className="font-medium text-black">{newEmail}</div>
      </div>

      <form action={formAction}>
        <input type="hidden" name="token" value={token} />
        {state.error && (
          <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </div>
        )}
        <button
          type="submit"
          disabled={pending}
          className="btn-primary w-full justify-center"
        >
          {pending ? "กำลังยืนยัน..." : "ยืนยันเปลี่ยนอีเมล"}
        </button>
      </form>
    </div>
  );
}
