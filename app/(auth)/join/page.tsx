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
    courseName: string;
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
        courseName: data.courseName,
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
      <div className="animate-fade-in rounded-2xl bg-white p-8 text-center shadow-card">
        <h1
          className="text-2xl font-medium text-black"
          style={{ letterSpacing: "-0.02em" }}
        >
          เข้าห้องเรียนสำเร็จ
        </h1>
        <div className="mt-5 rounded-xl bg-black/[0.04] p-4 text-sm">
          <div className="font-medium text-black">{success.courseName}</div>
          <div className="text-black/60">{success.className}</div>
          <div className="mt-2 text-xs text-black/60">
            ครูผู้สอน: {success.teacherName}
          </div>
        </div>
        <p className="mt-4 text-xs text-black/60">กำลังพาคุณไปหน้าหลัก...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in rounded-2xl bg-white p-8 shadow-card">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/[0.05] text-black">
          <LogIn className="h-5 w-5" />
        </div>
        <div>
          <h1
            className="text-2xl font-medium text-black"
            style={{ letterSpacing: "-0.02em" }}
          >
            เข้าร่วมห้องเรียน
          </h1>
          <p className="text-sm text-black/60">กรอกรหัสที่ครูให้</p>
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

        <div className="border-t border-black/[0.06] pt-4 text-center text-sm text-black/60">
          ยังไม่มีรหัส? ติดต่อครูประจำวิชา ·{" "}
          <Link href="/dashboard" className="text-black hover:underline">
            กลับหน้าหลัก
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="rounded-2xl bg-white p-8" />}>
      <JoinForm />
    </Suspense>
  );
}
