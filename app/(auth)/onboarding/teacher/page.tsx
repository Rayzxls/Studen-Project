import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { GoogleOnboardingForm } from "@/components/auth/google-onboarding-form";
import { identityFoundationMutationsEnabled } from "@/lib/identity/feature-flags";
import {
  PENDING_TEACHER_ONBOARDING_COOKIE,
  readPendingTeacherOnboardingToken,
} from "@/lib/identity/pending-teacher-onboarding";
import { completeTeacherOnboardingAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function TeacherOnboardingPage() {
  // Fail closed like every other flagged surface: the route does not exist
  // until the identity feature is enabled.
  if (!identityFoundationMutationsEnabled()) {
    notFound();
  }

  const secret = process.env.AUTH_SECRET ?? "";
  const token = (await cookies()).get(PENDING_TEACHER_ONBOARDING_COOKIE)?.value;

  let email: string | null = null;
  if (token) {
    try {
      const pending = await readPendingTeacherOnboardingToken({
        token,
        secret,
      });
      email = pending.email;
    } catch {
      email = null;
    }
  }

  if (!email) {
    return (
      <div className="animate-fade-in rounded-2xl bg-white p-8 shadow-card">
        <h1 className="text-2xl font-medium text-black">
          เริ่มจากลิงก์คำเชิญก่อน
        </h1>
        <p className="mt-2 text-sm text-black/60">
          ลิงก์ยืนยันหมดเวลาหรือยังไม่ได้เริ่ม
          กรุณาเปิดลิงก์คำเชิญของคุณอีกครั้ง
        </p>
        <Link
          href="/login"
          className="btn-secondary mt-5 inline-flex justify-center"
        >
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  return (
    <GoogleOnboardingForm
      email={email}
      action={completeTeacherOnboardingAction}
    />
  );
}
