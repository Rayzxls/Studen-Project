"use client";

import Link from "next/link";
import { MailCheck, ShieldCheck, UserRound } from "lucide-react";

import {
  GoogleSignInButton,
  googleSignInEnabled,
} from "@/components/auth/google-sign-in-button";

const steps = [
  {
    icon: MailCheck,
    title: "ยืนยันอีเมลด้วย Google",
    detail: "ใช้อีเมลที่ยืนยันแล้วเป็นบัญชีของคุณ",
  },
  {
    icon: UserRound,
    title: "กรอกชื่อจริงและนามสกุล",
    detail: "ชื่อที่ใช้ในห้องเรียนไม่จำเป็นต้องตรงกับชื่อ Google",
  },
  {
    icon: ShieldCheck,
    title: "เลือกเข้าห้องเรียนภายหลัง",
    detail: "สมัครบัญชีก่อน แล้วค่อยเข้าวิชาด้วยรหัสห้อง",
  },
] as const;

export default function SignupPage() {
  const googleEnabled = googleSignInEnabled();

  return (
    <div className="animate-fade-in rounded-2xl bg-white p-8 shadow-card">
      <div>
        <p className="text-sm font-medium text-blue-600">บัญชีผู้เรียน</p>
        <h1 className="mt-1 text-2xl font-semibold text-black">
          สร้างบัญชีด้วย Google
        </h1>
        <p className="mt-2 text-sm leading-6 text-black/60">
          Beagle Classroom ใช้อีเมลที่ยืนยันแล้วเป็นบัญชีของคุณ
          โดยไม่ผูกบัญชีกับห้องหรือภาคเรียนใดโดยอัตโนมัติ
        </p>
      </div>

      <div className="mt-6 space-y-2">
        {steps.map(({ icon: Icon, title, detail }) => (
          <div
            key={title}
            className="flex items-start gap-3 rounded-xl bg-black/[0.025] px-3 py-3"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-black">
                {title}
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-black/50">
                {detail}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6">
        {googleEnabled ? (
          <GoogleSignInButton
            callbackUrl="/dashboard"
            label="สมัครและดำเนินการต่อด้วย Google"
          />
        ) : (
          <div className="rounded-xl bg-orange-50 px-3 py-3 text-sm text-orange-800">
            ระบบสมัครด้วย Google ยังไม่เปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-xs leading-5 text-black/45">
        หลังยืนยันกับ Google ระบบจะให้คุณกรอกชื่อจริง นามสกุล
        และยอมรับนโยบายก่อนสร้างบัญชี
      </p>

      <div className="mt-5 border-t border-black/[0.06] pt-4 text-center text-sm text-black/60">
        มีบัญชีแล้ว?{" "}
        <Link
          href="/login"
          className="font-medium text-black underline-offset-2 hover:underline"
        >
          เข้าสู่ระบบ
        </Link>
      </div>
    </div>
  );
}
