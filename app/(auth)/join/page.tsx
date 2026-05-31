"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";

function JoinForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [code, setCode] = useState(search.get("code") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    subjectName: string;
    className: string;
    teacherName: string;
  } | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setPending(true);

    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      if (!res.ok) {
        const code = data.error?.code;
        if (code === "class_code_invalid")
          setError("ไม่พบรหัสห้องเรียนนี้ ตรวจสอบรหัสอีกครั้ง");
        else if (code === "class_code_disabled")
          setError("รหัสห้องเรียนนี้ถูกปิดใช้งานแล้ว");
        else if (code === "class_code_expired")
          setError("รหัสห้องเรียนนี้หมดอายุแล้ว");
        else if (code === "already_enrolled")
          setError("คุณเข้าร่วมห้องเรียนนี้อยู่แล้ว");
        else if (code === "not_a_student")
          setError("เฉพาะนักเรียนเท่านั้นที่เข้าห้องเรียนได้");
        else setError(data.error?.message ?? "เกิดข้อผิดพลาด");
        setPending(false);
        return;
      }

      setSuccess({
        subjectName: data.subjectName,
        className: data.className,
        teacherName: data.teacherName,
      });
      setPending(false);

      // Redirect after a short pause
      setTimeout(() => router.push("/dashboard"), 1800);
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ลองอีกครั้ง");
      setPending(false);
    }
  }

  if (success) {
    return (
      <div className="glass animate-slide-up rounded-2xl p-8 shadow-lift text-center">
        <div className="mb-3 text-5xl">🎉</div>
        <h1 className="text-2xl font-bold tracking-tight">
          เข้าห้องเรียนสำเร็จ
        </h1>
        <div className="mt-4 rounded-lg bg-white/60 p-4 text-sm">
          <div className="font-semibold text-ink">{success.subjectName}</div>
          <div className="text-ink-soft">{success.className}</div>
          <div className="mt-2 text-xs text-ink-soft">
            ครูผู้สอน: {success.teacherName}
          </div>
        </div>
        <p className="mt-4 text-xs text-ink-soft">กำลังพาคุณไปหน้าหลัก...</p>
      </div>
    );
  }

  return (
    <div className="glass animate-slide-up rounded-2xl p-8 shadow-lift">
      <div className="mb-6 flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft">
          <LogIn className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            เข้าร่วมห้องเรียน
          </h1>
          <p className="text-sm text-ink-soft">กรอกรหัสที่ครูให้</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="code" className="mb-1.5 block text-sm font-medium">
            รหัสห้องเรียน
          </label>
          <input
            id="code"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            className="input font-mono tracking-wider"
            placeholder="เช่น MATH4A-A8K2X3"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={pending || !code}
          className="btn-primary w-full justify-center"
        >
          {pending ? "กำลังเข้าร่วม..." : "เข้าร่วมห้องเรียน"}
        </button>

        <div className="border-t border-slate-200 pt-4 text-center text-sm text-ink-soft">
          ยังไม่มีรหัส? ติดต่อครูประจำวิชา ·{" "}
          <Link href="/dashboard" className="text-ink hover:underline">
            กลับหน้าหลัก
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="glass rounded-2xl p-8" />}>
      <JoinForm />
    </Suspense>
  );
}
