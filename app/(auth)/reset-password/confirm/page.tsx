import Link from "next/link";
import { notFound } from "next/navigation";

import { SetNewPasswordForm } from "@/components/auth/set-new-password-form";
import { identityFoundationMutationsEnabled } from "@/lib/identity/feature-flags";
import { readPasswordResetToken } from "@/lib/identity/password-reset-token";
import { completePasswordResetAction } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ConfirmPasswordResetPage({
  searchParams,
}: PageProps) {
  // Fail closed like every other flagged surface: the route does not exist
  // until the identity feature is enabled.
  if (!identityFoundationMutationsEnabled()) {
    notFound();
  }

  const { token } = await searchParams;
  const secret = process.env.AUTH_SECRET ?? "";

  // A parse-only check for a friendly early error; the fingerprint and account
  // state are re-checked authoritatively when the form is submitted.
  let valid = false;
  if (token) {
    try {
      await readPasswordResetToken({ token, secret });
      valid = true;
    } catch {
      valid = false;
    }
  }

  if (!token || !valid) {
    return (
      <div className="animate-fade-in rounded-2xl bg-white p-8 shadow-card">
        <h1 className="text-2xl font-medium text-black">ลิงก์หมดอายุ</h1>
        <p className="mt-2 text-sm text-black/60">
          ลิงก์ตั้งรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว
          กรุณาขอลิงก์ใหม่จากหน้าลืมรหัสผ่าน
        </p>
        <Link
          href="/reset-password"
          className="btn-secondary mt-5 inline-flex justify-center"
        >
          ไปหน้าลืมรหัสผ่าน
        </Link>
      </div>
    );
  }

  return (
    <SetNewPasswordForm token={token} action={completePasswordResetAction} />
  );
}
