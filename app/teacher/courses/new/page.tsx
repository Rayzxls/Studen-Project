import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import {
  getActiveAcademicYear,
  getClassesByYear,
  getTermsByYear,
} from "@/lib/course/queries";
import { CreateCourseForm } from "./form";

export default async function NewCoursePage() {
  try {
    await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const year = await getActiveAcademicYear();
  if (!year) {
    return (
      <div className="mesh-bg min-h-screen">
        <main className="mx-auto max-w-3xl px-6 py-12">
          <div className="card p-6">
            <h1 className="font-semibold">ยังไม่มีปีการศึกษาเปิดใช้งาน</h1>
            <p className="mt-2 text-sm text-ink-soft">
              กรุณาติดต่อ Admin เพื่อตั้งค่าปีการศึกษา
            </p>
          </div>
        </main>
      </div>
    );
  }

  const [classes, terms] = await Promise.all([
    getClassesByYear(year.id),
    getTermsByYear(year.id),
  ]);

  return (
    <div className="mesh-bg min-h-screen">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <Link href="/teacher/courses" className="btn-ghost btn-sm">
            <ChevronLeft className="h-4 w-4" />
            กลับ
          </Link>
          <span className="text-xs text-ink-soft">ปี {year.name}</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 animate-fade-in">
        <h1 className="text-3xl font-bold tracking-tight">สร้างวิชาใหม่</h1>
        <p className="mt-1 text-sm text-ink-soft">
          ตั้งชื่อ + กำหนดหน่วยกิตเอง — ระบบสร้างรหัสห้องให้อัตโนมัติ
        </p>

        <div className="mt-8">
          <CreateCourseForm classes={classes} terms={terms} />
        </div>
      </main>
    </div>
  );
}
