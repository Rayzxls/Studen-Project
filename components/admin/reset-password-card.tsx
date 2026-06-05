"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Copy, KeyRound } from "lucide-react";
import {
  resetPasswordAction,
  type ResetPasswordState,
} from "@/app/admin/users/[id]/actions";

const INITIAL: ResetPasswordState = {};

export function ResetPasswordCard({
  userId,
  displayName,
}: {
  userId: string;
  displayName: string;
}) {
  const [state, action] = useActionState(resetPasswordAction, INITIAL);
  const [copied, setCopied] = useState(false);

  function copy() {
    if (!state.tempPassword) return;
    navigator.clipboard.writeText(state.tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="card p-6">
      <h2 className="mb-3 text-sm font-medium text-black/80 flex items-center gap-2">
        <KeyRound className="h-4 w-4" />
        รีเซ็ตรหัสผ่าน
      </h2>

      {!state.ok && (
        <>
          <p className="mb-3 text-xs text-black/60">
            ระบบจะสร้างรหัสผ่านชั่วคราวให้{" "}
            <span className="font-medium text-black">{displayName}</span> —
            แสดงครั้งเดียวเพื่อให้คุณคัดลอกไปแจ้งผู้ใช้
            ผู้ใช้จะต้องเปลี่ยนรหัสผ่านในการเข้าระบบครั้งแรก
          </p>
          <form action={action}>
            <input type="hidden" name="userId" value={userId} />
            <ResetButton />
            {state.error && (
              <p className="mt-2 text-xs text-rose-600">
                {translateError(state.error)}
              </p>
            )}
          </form>
        </>
      )}

      {state.ok && state.tempPassword && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-900">
            <CheckCircle2 className="h-4 w-4" />
            รีเซ็ตรหัสผ่านของ {state.targetDisplayName} สำเร็จ
          </div>
          <p className="text-xs text-emerald-900/70">
            รหัสผ่านชั่วคราว (แสดงครั้งเดียว — รีเฟรชแล้วจะหาย):
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-white px-3 py-2 font-mono text-sm tracking-wider">
              {state.tempPassword}
            </code>
            <button
              type="button"
              onClick={copy}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
            >
              {copied ? (
                "คัดลอกแล้ว"
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Copy className="h-3 w-3" /> คัดลอก
                </span>
              )}
            </button>
          </div>
          <p className="mt-2 flex items-start gap-1 text-xs text-amber-800">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
            เก็บไว้แจ้งผู้ใช้ตอนนี้ — หน้านี้รีเฟรชแล้วรหัสผ่านจะหายไป (จะต้อง
            reset ใหม่ถ้าลืม)
          </p>
        </div>
      )}
    </section>
  );
}

function ResetButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "กำลังรีเซ็ต…" : "รีเซ็ตรหัสผ่าน"}
    </button>
  );
}

function translateError(code: string): string {
  switch (code) {
    case "user_not_found":
      return "ไม่พบผู้ใช้";
    case "self_reset":
      return "คุณไม่สามารถรีเซ็ตรหัสผ่านของตัวเองได้ — ใช้เมนูเปลี่ยนรหัสผ่านแทน";
    case "not_admin":
      return "เฉพาะ Admin เท่านั้น";
    default:
      return code;
  }
}
