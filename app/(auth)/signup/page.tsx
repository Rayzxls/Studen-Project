"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { TurnstileWidget } from "@/components/turnstile-widget";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export default function SignupPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setPending(true);

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          firstName,
          lastName,
          password,
          confirmPassword,
          consent,
          turnstileToken,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 400 && data.error?.details) {
          setErrors(data.error.details as Record<string, string>);
        } else if (res.status === 409) {
          setErrors({ studentId: "เลขประจำตัวนี้สมัครไปแล้ว" });
        } else if (res.status === 429) {
          setErrors({
            _form: "สมัครบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่",
          });
        } else {
          setErrors({ _form: data.error?.message ?? "เกิดข้อผิดพลาด" });
        }
        setPending(false);
        return;
      }

      // Auto sign in after successful signup
      await signIn("credentials", {
        identifier: studentId,
        password,
        redirectTo: "/dashboard",
      });
      router.push("/dashboard");
    } catch {
      setErrors({ _form: "ส่งข้อมูลไม่สำเร็จ ลองอีกครั้ง" });
      setPending(false);
    }
  }

  return (
    <div className="animate-fade-in rounded-2xl bg-white p-8 shadow-card">
      <h1
        className="text-2xl font-medium text-black"
        style={{ letterSpacing: "-0.02em" }}
      >
        สมัครสมาชิก
      </h1>
      <p className="mt-1 text-sm text-black/60">สำหรับนักเรียนเท่านั้น</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="studentId"
            className="mb-1.5 block text-sm font-medium"
          >
            เลขประจำตัวนักเรียน
          </label>
          <input
            id="studentId"
            type="text"
            inputMode="numeric"
            autoComplete="username"
            required
            className="input"
            placeholder="เช่น 60001"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          />
          {errors.studentId && (
            <p className="mt-1 text-xs text-red-700">{errors.studentId}</p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="firstName"
              className="mb-1.5 block text-sm font-medium"
            >
              ชื่อ
            </label>
            <input
              id="firstName"
              type="text"
              autoComplete="given-name"
              required
              className="input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            {errors.firstName && (
              <p className="mt-1 text-xs text-red-700">{errors.firstName}</p>
            )}
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
              type="text"
              autoComplete="family-name"
              required
              className="input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
            {errors.lastName && (
              <p className="mt-1 text-xs text-red-700">{errors.lastName}</p>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-medium"
          >
            รหัสผ่าน
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="input"
            placeholder="ขั้นต่ำ 8 ตัวอักษร"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red-700">{errors.password}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-1.5 block text-sm font-medium"
          >
            ยืนยันรหัสผ่าน
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            className="input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-red-700">
              {errors.confirmPassword}
            </p>
          )}
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-black/60">
            ข้าพเจ้ายอมรับ{" "}
            <Link
              href="/privacy"
              target="_blank"
              className="text-black underline"
            >
              นโยบายความเป็นส่วนตัว (PDPA)
            </Link>
          </span>
        </label>
        {errors.consent && (
          <p className="text-xs text-red-700">{errors.consent}</p>
        )}

        {TURNSTILE_SITE_KEY && (
          <div>
            <TurnstileWidget
              siteKey={TURNSTILE_SITE_KEY}
              onVerify={setTurnstileToken}
              onError={() => setTurnstileToken("")}
            />
            {errors.turnstileToken && (
              <p className="mt-1 text-xs text-red-700">
                {errors.turnstileToken}
              </p>
            )}
          </div>
        )}

        {errors._form && (
          <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {errors._form}
          </div>
        )}

        <button
          type="submit"
          disabled={pending || !consent || !turnstileToken}
          className="btn-primary w-full justify-center"
        >
          {pending ? "กำลังสร้างบัญชี..." : "สมัครสมาชิก"}
          {!pending && <span aria-hidden>→</span>}
        </button>

        <div className="border-t border-black/[0.06] pt-4 text-center text-sm text-black/60">
          มีบัญชีแล้ว?{" "}
          <Link
            href="/login"
            className="font-medium text-black underline-offset-2 hover:underline"
          >
            เข้าสู่ระบบ
          </Link>
        </div>
      </form>
    </div>
  );
}
