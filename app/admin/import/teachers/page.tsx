import Link from "next/link";
import { ChevronLeft, Download } from "lucide-react";
import { TeacherImportForm } from "./form";

const SAMPLE_CSV = `email,firstName,lastName
somchai@school.local,สมชาย,ใจดี
sompong@school.local,สมพงษ์,ขยัน
sukanya@school.local,สุกัญญา,สวยงาม`;

export default function TeacherImportPage() {
  const sampleDataUrl =
    "data:text/csv;charset=utf-8," + encodeURIComponent(SAMPLE_CSV);

  return (
    <div className="animate-fade-in p-6 md:p-10 space-y-5 max-w-4xl">
      <Link href="/admin/import" className="btn-ghost btn-sm w-fit">
        <ChevronLeft className="h-4 w-4" />
        กลับ
      </Link>

      <div>
        <h1 className="text-3xl font-medium tracking-tight">
          นำเข้าครูจาก CSV
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          อัพโหลดไฟล์ CSV → ดูตัวอย่าง → ยืนยันนำเข้า —
          ระบบสร้างรหัสผ่านชั่วคราวให้ทุกคน
        </p>
      </div>

      <div className="card p-5 bg-orange-50/40 border-orange-200">
        <h2 className="font-semibold tracking-tight">รูปแบบไฟล์ที่รองรับ</h2>
        <p className="mt-1 text-sm text-ink-soft">
          UTF-8 CSV ที่มี header:{" "}
          <code className="font-mono">email, firstName, lastName</code>
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-white p-3 text-xs font-mono">
          {SAMPLE_CSV}
        </pre>
        <a
          href={sampleDataUrl}
          download="teachers-template.csv"
          className="btn-secondary btn-sm mt-3"
        >
          <Download className="h-4 w-4" />
          ดาวน์โหลดไฟล์ตัวอย่าง
        </a>
      </div>

      <TeacherImportForm />
    </div>
  );
}
