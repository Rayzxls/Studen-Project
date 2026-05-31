import Link from "next/link";

export default function SignupPage() {
  return (
    <div className="glass animate-slide-up rounded-2xl p-8 shadow-lift">
      <h1 className="text-2xl font-bold tracking-tight">
        สมัครสมาชิก (นักเรียน)
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        ฟอร์มสมัครสมาชิกจะใส่ครบในขั้นต่อไปของ Phase 1 — รวมถึง Turnstile
        CAPTCHA และ PDPA consent
      </p>

      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        ⚠️ Phase 1 — placeholder. ตอนนี้สามารถ login ด้วยบัญชีจาก seed ได้:
        <ul className="mt-2 list-inside list-disc text-xs">
          <li>
            นักเรียน: <code className="font-mono">60001</code> /{" "}
            <code className="font-mono">Student1234</code>
          </li>
        </ul>
      </div>

      <Link href="/login" className="btn-ghost mt-6 w-full justify-center">
        ← กลับหน้า Login
      </Link>
    </div>
  );
}
