import Link from "next/link";
import {
  Users,
  GraduationCap,
  BookOpen,
  ScrollText,
  Upload,
  Settings2,
  Activity,
  AlertTriangle,
  KeyRound,
} from "lucide-react";
import { getAdminStats, currentTerm } from "@/lib/dashboard/queries";
import { ActionRow, MetricTile } from "@/components/dashboard/primitives";

// Auth-gated DB-fetching page — skip static prerender.
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const term = await currentTerm();
  const stats = await getAdminStats();

  // Operational alerts — short, actionable, never a feed (CONTEXT decision:
  // no activity timeline on the admin dashboard; the browsing surface is
  // /admin/activity, the security trail is /admin/audit).
  const alerts: { key: string; text: string; href: string; label: string }[] =
    [];
  if (stats.criticalAuditsLast7d > 0) {
    alerts.push({
      key: "critical-audits",
      text: `มีเหตุการณ์ระดับ Critical ${stats.criticalAuditsLast7d} รายการใน 7 วันล่าสุด`,
      href: "/admin/audit?tier=CRITICAL",
      label: "เปิด Audit Log",
    });
  }
  if (!term) {
    alerts.push({
      key: "no-term",
      text: "ยังไม่ได้ตั้งภาคเรียนปัจจุบัน — ครูจะยังสร้างวิชาไม่ได้",
      href: "/admin/setup",
      label: "ตั้งค่าโครงสร้าง",
    });
  }
  if (stats.teacherCount === 0) {
    alerts.push({
      key: "no-teachers",
      text: "ยังไม่มีบัญชีครูในระบบ",
      href: "/admin/import/teachers",
      label: "นำเข้าครูจาก CSV",
    });
  }

  return (
    <div className="animate-fade-in space-y-6 p-6 md:p-10">
      <div>
        <h1
          className="text-3xl font-medium text-black"
          style={{ letterSpacing: "-0.02em" }}
        >
          ภาพรวมระบบ
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {term
            ? `ปีการศึกษา ${term.academicYearName} · ${term.name}`
            : "ยังไม่ได้ตั้งภาคเรียนปัจจุบัน"}{" "}
          · {stats.classCount} ห้องเรียน · {stats.teacherCount} ครู ·{" "}
          {stats.studentCount} นักเรียน
        </p>
      </div>

      {/* Operational alerts — only when something needs attention. */}
      {alerts.length > 0 && (
        <section
          className="rounded-2xl bg-red-50/70 p-2 ring-1 ring-red-500/15"
          aria-label="สิ่งที่ต้องระวัง"
        >
          <ul className="divide-y divide-red-500/10">
            {alerts.map((a) => (
              <li
                key={a.key}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
              >
                <span className="inline-flex items-center gap-2 text-sm text-red-900">
                  <AlertTriangle
                    className="h-4 w-4 shrink-0 text-red-500"
                    aria-hidden="true"
                  />
                  {a.text}
                </span>
                <Link
                  href={a.href}
                  className="text-xs font-semibold text-red-700 hover:underline"
                >
                  {a.label} →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* System KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          icon={Users}
          label="ครู"
          value={stats.teacherCount}
          suffix="คน"
          href="/admin/teachers"
          tone="blue"
        />
        <MetricTile
          icon={GraduationCap}
          label="นักเรียน"
          value={stats.studentCount}
          suffix="คน"
          href="/admin/students"
          tone="blue"
        />
        <MetricTile
          icon={BookOpen}
          label="ห้องเรียน (ปีปัจจุบัน)"
          value={stats.classCount}
          suffix="ห้อง"
        />
        <MetricTile
          icon={ScrollText}
          label="Critical Audit (7 วัน)"
          value={stats.criticalAuditsLast7d}
          suffix="รายการ"
          href="/admin/audit?tier=CRITICAL"
          tone={stats.criticalAuditsLast7d > 0 ? "red" : "green"}
        />
      </div>

      {/* Admin tasks + review surfaces */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2
            className="text-base font-semibold text-black"
            style={{ letterSpacing: "-0.01em" }}
          >
            งานผู้ดูแล
          </h2>
          <div className="-mx-3 mt-2">
            <ActionRow
              href="/admin/setup"
              title="ตั้งค่าโครงสร้าง"
              meta="ปีการศึกษา · ภาคเรียน · ห้องเรียน · เพิ่มครูรายคน"
              leading={<IconChip icon={<Settings2 className="h-4 w-4" />} />}
            />
            <ActionRow
              href="/admin/import/teachers"
              title="นำเข้าครูจาก CSV"
              meta="สร้างบัญชีครูเป็นชุด พร้อมรหัสผ่านชั่วคราว"
              leading={<IconChip icon={<Upload className="h-4 w-4" />} />}
            />
            <ActionRow
              href="/admin/teachers"
              title="รีเซ็ตรหัสผ่าน"
              meta="เลือกครู/นักเรียนจากรายชื่อ แล้วรีเซ็ตจากหน้าโปรไฟล์"
              leading={<IconChip icon={<KeyRound className="h-4 w-4" />} />}
            />
          </div>
        </section>

        <section className="card p-5">
          <h2
            className="text-base font-semibold text-black"
            style={{ letterSpacing: "-0.01em" }}
          >
            การตรวจสอบ
          </h2>
          <div className="-mx-3 mt-2">
            <ActionRow
              href="/admin/audit"
              title="Audit Log"
              meta="บันทึกความปลอดภัย · การแก้คะแนน · การลบข้อมูล"
              leading={<IconChip icon={<ScrollText className="h-4 w-4" />} />}
            />
            <ActionRow
              href="/admin/activity"
              title="กิจกรรมในระบบ"
              meta="การบ้าน · เอกสาร · ประกาศ · การเปิดวิชา ของครูทั้งโรงเรียน"
              leading={<IconChip icon={<Activity className="h-4 w-4" />} />}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function IconChip({ icon }: { icon: React.ReactNode }) {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-black/[0.05] text-black/60">
      {icon}
    </span>
  );
}
