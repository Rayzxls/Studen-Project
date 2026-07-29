import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";

import { identityFoundationMutationsEnabled } from "@/lib/identity/feature-flags";
import { PasswordRecoveryRequestForm } from "@/components/auth/password-recovery-request-form";
import { requestPasswordResetAction } from "./actions";

/**
 * /reset-password — account recovery.
 *
 * With the identity feature on, this is the email-link self-service recovery
 * for a fallback password (ADR-0042, superseding ADR-0026 for that path): the
 * owner requests a single-use link and sets a new password. With the feature
 * off it displays recovery-unavailable guidance. Admin-issued temporary
 * passwords and forced-reset sessions are retired.
 */
export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  if (identityFoundationMutationsEnabled()) {
    return <PasswordRecoveryRequestForm action={requestPasswordResetAction} />;
  }

  return (
    <div className="animate-fade-in rounded-2xl bg-white p-8 shadow-card">
      <div className="flex items-start gap-3.5">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600"
          aria-hidden="true"
        >
          <KeyRound className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1
            className="text-2xl font-medium text-black"
            style={{ letterSpacing: "-0.02em" }}
          >
            การกู้รหัสผ่านยังไม่พร้อมใช้งาน
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-black/60">
            กรุณาติดต่อผู้ดูแลระบบเพื่อตรวจสอบการตั้งค่าอีเมล
            ระบบจะไม่ออกรหัสผ่านชั่วคราวหรือขอรหัสผ่านเดิมจากคุณ
          </p>
        </div>
      </div>

      <Link
        href="/login"
        className="btn-ghost mt-7 w-full justify-center gap-2"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        กลับหน้าเข้าสู่ระบบ
      </Link>
    </div>
  );
}
