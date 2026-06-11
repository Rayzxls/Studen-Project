import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { CreateTeacherForm } from "./create-teacher-form";

export const dynamic = "force-dynamic";

export default async function NewTeacherPage() {
  try {
    await requireRole(["ADMIN"]);
  } catch {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6 md:p-10">
      <Link href="/admin/teachers" className="btn-ghost btn-sm w-fit">
        <ChevronLeft className="h-4 w-4" />
        กลับหน้าครู
      </Link>

      <header>
        <p className="badge w-fit">ครู</p>
        <h1 className="mt-3 text-3xl font-medium tracking-tight">
          เพิ่มครูรายคน
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          สร้างบัญชีครูใหม่พร้อมรหัสผ่านชั่วคราว
          หลังบันทึกเสร็จระบบจะพากลับไปหน้ารายชื่อครู
        </p>
      </header>

      <CreateTeacherForm />
    </div>
  );
}
