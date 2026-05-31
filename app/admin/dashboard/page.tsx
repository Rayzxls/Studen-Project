import Link from "next/link";
import {
  Users,
  GraduationCap,
  BookOpen,
  ScrollText,
  Upload,
} from "lucide-react";
import { db } from "@/lib/db/client";

export default async function AdminDashboardPage() {
  const [teachers, students, courses, enrollments, recentAudits] =
    await Promise.all([
      db.teacher.count(),
      db.student.count({ where: { anonymized: false } }),
      db.courseOffering.count(),
      db.enrollment.count(),
      db.auditLog.findMany({
        orderBy: { timestamp: "desc" },
        take: 8,
        select: {
          id: true,
          timestamp: true,
          action: true,
          actorRole: true,
          targetId: true,
          actor: { select: { identifier: true } },
        },
      }),
    ]);

  const dateFmt = new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="animate-fade-in p-6 md:p-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">ภาพรวมระบบ</h1>
        <p className="mt-1 text-sm text-ink-soft">
          สรุปข้อมูลการใช้งานและกิจกรรมล่าสุด
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Users className="h-5 w-5" />}
          label="ครู"
          value={teachers}
          href="/admin/teachers"
        />
        <KpiCard
          icon={<GraduationCap className="h-5 w-5" />}
          label="นักเรียน"
          value={students}
          href="/admin/students"
        />
        <KpiCard
          icon={<BookOpen className="h-5 w-5" />}
          label="วิชาที่เปิดสอน"
          value={courses}
        />
        <KpiCard
          icon={<ScrollText className="h-5 w-5" />}
          label="การลงทะเบียน"
          value={enrollments}
        />
      </div>

      {/* Quick actions */}
      <section className="card p-5">
        <h2 className="font-semibold tracking-tight">งานด่วน</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/admin/import/teachers" className="btn-primary btn-sm">
            <Upload className="h-4 w-4" />
            นำเข้าครูจาก CSV
          </Link>
          <Link href="/admin/teachers" className="btn-secondary btn-sm">
            <Users className="h-4 w-4" />
            จัดการครู
          </Link>
          <Link href="/admin/students" className="btn-secondary btn-sm">
            <GraduationCap className="h-4 w-4" />
            จัดการนักเรียน
          </Link>
          <Link href="/admin/audit" className="btn-secondary btn-sm">
            <ScrollText className="h-4 w-4" />
            ดู Audit Log
          </Link>
        </div>
      </section>

      {/* Recent activity */}
      <section className="card p-5">
        <h2 className="mb-3 font-semibold tracking-tight">กิจกรรมล่าสุด</h2>
        {recentAudits.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-4 text-center text-sm text-ink-soft">
            ยังไม่มีกิจกรรม
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 -mx-2">
            {recentAudits.map((a) => (
              <li
                key={a.id}
                className="flex items-start justify-between gap-3 px-2 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-mono text-xs text-ink-soft">
                    {a.action}
                  </div>
                  <div className="mt-0.5 text-ink truncate">
                    {a.actor?.identifier ?? "ระบบ"}
                    {a.actorRole ? ` · ${a.actorRole}` : ""}
                  </div>
                </div>
                <div className="text-xs text-ink-soft whitespace-nowrap">
                  {dateFmt.format(a.timestamp)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  href?: string;
}) {
  const inner = (
    <div className="stat">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-ink-soft">
          {icon}
        </div>
        <div className="stat-label">{label}</div>
      </div>
      <div className="stat-value mt-3">{value.toLocaleString("th-TH")}</div>
    </div>
  );
  return href ? (
    <Link href={href} className="block hover:no-underline">
      {inner}
    </Link>
  ) : (
    inner
  );
}
