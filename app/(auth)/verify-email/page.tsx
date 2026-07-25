import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmEmailChangeForm } from "@/components/auth/confirm-email-change-form";
import { identityFoundationMutationsEnabled } from "@/lib/identity/feature-flags";
import { readEmailChangeToken } from "@/lib/identity/email-change-token";
import { confirmEmailChangeAction } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: PageProps) {
  // Fail closed like every other flagged surface: the route does not exist
  // until the identity feature is enabled.
  if (!identityFoundationMutationsEnabled()) {
    notFound();
  }

  const { token } = await searchParams;
  const secret = process.env.AUTH_SECRET ?? "";

  // Parse-only, to show the target address and a friendly early error; the
  // fingerprint, account state, and uniqueness are re-checked on confirm.
  let newEmail: string | null = null;
  if (token) {
    try {
      const pending = await readEmailChangeToken({ token, secret });
      newEmail = pending.newEmail;
    } catch {
      newEmail = null;
    }
  }

  if (!token || !newEmail) {
    return (
      <div className="animate-fade-in rounded-2xl bg-white p-8 shadow-card">
        <h1 className="text-2xl font-medium text-black">ลิงก์หมดอายุ</h1>
        <p className="mt-2 text-sm text-black/60">
          ลิงก์ยืนยันอีเมลไม่ถูกต้องหรือหมดอายุแล้ว
          กรุณาขอเปลี่ยนอีเมลใหม่จากหน้าโปรไฟล์
        </p>
        <Link
          href="/login"
          className="btn-secondary mt-5 inline-flex justify-center"
        >
          ไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  return (
    <ConfirmEmailChangeForm
      token={token}
      newEmail={newEmail}
      action={confirmEmailChangeAction}
    />
  );
}
