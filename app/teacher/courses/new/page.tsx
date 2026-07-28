import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { TopNav } from "@/components/layout/top-nav";
import { CreateCourseForm } from "./form";

// Auth-gated DB-fetching page — skip static prerender.
export const dynamic = "force-dynamic";

export default async function NewCoursePage() {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-bg">
      <TopNav session={session} maxWidth="max-w-6xl" />
      <div className="border-b border-black/[0.06] bg-white/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <Link href="/teacher/courses" className="btn-ghost btn-sm">
            <ChevronLeft className="h-4 w-4" />
            กลับ
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-3xl animate-fade-in px-6 py-10">
        <h1
          className="text-3xl font-medium text-black md:text-4xl"
          style={{ letterSpacing: "-0.03em" }}
        >
          สร้างวิชาใหม่
        </h1>
        <p className="mt-1 text-sm text-black/60">
          ตั้งชื่อวิชาและใส่รายละเอียดเท่าที่จำเป็นได้เอง
          ระบบสร้างรหัสเข้าร่วมให้อัตโนมัติ
        </p>

        <div className="mt-8">
          <CreateCourseForm />
        </div>
      </main>
    </div>
  );
}
