import Link from "next/link";

export default function ResetPasswordPage() {
  return (
    <div className="animate-fade-in rounded-2xl bg-white p-8 shadow-card">
      <h1
        className="text-2xl font-medium text-black"
        style={{ letterSpacing: "-0.02em" }}
      >
        รีเซ็ตรหัสผ่าน
      </h1>
      <p className="mt-2 text-sm text-black/60">
        ฟีเจอร์รีเซ็ตรหัสผ่านจะเสร็จในขั้นต่อไปของ Phase 1
      </p>
      <div className="mt-4 rounded-xl bg-black/[0.04] p-3 text-sm text-black/70">
        <strong className="font-medium text-black">นักเรียน:</strong>{" "}
        ติดต่อครูประจำวิชา หรือครูที่สอน
        <br />
        <strong className="font-medium text-black">ครู / Admin:</strong>{" "}
        ลิงก์รีเซ็ตจะส่งทางอีเมล (Phase 1 ภายหลัง)
      </div>
      <Link href="/login" className="btn-ghost mt-6 w-full justify-center">
        ← กลับหน้า Login
      </Link>
    </div>
  );
}
