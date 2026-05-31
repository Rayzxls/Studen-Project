import Link from "next/link";

export default function ResetPasswordPage() {
  return (
    <div className="glass animate-slide-up rounded-2xl p-8 shadow-lift">
      <h1 className="text-2xl font-bold tracking-tight">รีเซ็ตรหัสผ่าน</h1>
      <p className="mt-2 text-sm text-ink-soft">
        ฟีเจอร์รีเซ็ตรหัสผ่านจะเสร็จในขั้นต่อไปของ Phase 1
      </p>
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-ink-soft">
        <strong>นักเรียน:</strong> ติดต่อครูประจำวิชา หรือครูที่สอน
        <br />
        <strong>ครู / Admin:</strong> ลิงก์รีเซ็ตจะส่งทางอีเมล (Phase 1 ภายหลัง)
      </div>
      <Link href="/login" className="btn-ghost mt-6 w-full justify-center">
        ← กลับหน้า Login
      </Link>
    </div>
  );
}
