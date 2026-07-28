import Link from "next/link";

import { identityFoundationMutationsEnabled } from "@/lib/identity/feature-flags";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { EmailSignupForm } from "@/components/auth/email-signup-form";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  const signupEnabled = identityFoundationMutationsEnabled();
  // Read the public flag directly here: googleSignInEnabled() lives in a
  // "use client" module and cannot be invoked from this server component.
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED === "1";

  return (
    <div className="animate-fade-in rounded-2xl bg-white p-8 shadow-card">
      <div>
        <p className="text-sm font-medium text-blue-600">บัญชีผู้เรียน</p>
        <h1 className="mt-1 text-2xl font-semibold text-black">สมัครสมาชิก</h1>
        <p className="mt-2 text-sm leading-6 text-black/60">
          สมัครด้วยอีเมลและรหัสผ่าน แล้วเข้าใช้งานได้ทันที
          {googleEnabled ? " หรือจะใช้ Google ก็ได้" : ""}
        </p>
      </div>

      {signupEnabled ? (
        <>
          <div className="mt-6">
            <EmailSignupForm />
          </div>

          {googleEnabled && (
            <div className="mt-4">
              <div className="relative my-4 text-center">
                <span className="relative z-10 bg-white px-3 text-xs text-black/40">
                  หรือ
                </span>
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-1/2 border-t border-black/[0.06]"
                />
              </div>
              <GoogleSignInButton
                callbackUrl="/dashboard"
                label="สมัครด้วย Google"
              />
              <p className="mt-3 text-center text-xs leading-5 text-black/45">
                ถ้าใช้ Google ระบบจะให้กรอกชื่อจริงและยอมรับนโยบายก่อนสร้างบัญชี
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="mt-6 rounded-xl bg-orange-50 px-3 py-3 text-sm text-orange-800">
          การสมัครสมาชิกยังไม่เปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ
        </div>
      )}

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
