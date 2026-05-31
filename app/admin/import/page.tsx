import Link from "next/link";
import { Users, ChevronRight } from "lucide-react";

export default function AdminImportPage() {
  return (
    <div className="animate-fade-in p-6 md:p-10 space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">นำเข้าข้อมูล</h1>
        <p className="mt-1 text-sm text-ink-soft">
          เพิ่มข้อมูลจำนวนมากจากไฟล์ CSV
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/admin/import/teachers"
          className="card sheen p-6 hover:no-underline group"
        >
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Users className="h-5 w-5" />
            </div>
            <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-ink transition-colors" />
          </div>
          <h2 className="mt-4 font-semibold tracking-tight">นำเข้าครู</h2>
          <p className="mt-1 text-sm text-ink-soft">
            อัพโหลด CSV ที่มี email, firstName, lastName — ระบบสร้างบัญชี +
            รหัสผ่านชั่วคราว
          </p>
        </Link>

        <div className="card-flat p-6 opacity-60">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
            <Users className="h-5 w-5" />
          </div>
          <h2 className="mt-4 font-semibold tracking-tight">นำเข้านักเรียน</h2>
          <p className="mt-1 text-sm text-ink-soft">
            นักเรียนสมัครเอง (Student self-register) — ไม่ต้อง CSV import
          </p>
        </div>
      </div>
    </div>
  );
}
