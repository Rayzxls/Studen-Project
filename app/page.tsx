import Link from "next/link";
import { GraduationCap, ShieldCheck, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <main className="mesh-bg relative min-h-screen overflow-hidden">
      {/* Floating blobs */}
      <div
        aria-hidden
        className="blob animate-float-slow bg-amber-300"
        style={{ width: 480, height: 480, top: -120, right: -100 }}
      />
      <div
        aria-hidden
        className="blob animate-float bg-slate-300"
        style={{ width: 360, height: 360, bottom: -120, left: -80 }}
      />

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-20 animate-fade-in">
        <div className="badge-gold mb-5">Studennnn · ปีการศึกษา 2568</div>

        <h1 className="text-5xl font-bold tracking-tight md:text-6xl">
          <span className="block">ระบบจัดการ</span>
          <span className="text-gradient-gold">ห้องเรียนยุคใหม่</span>
        </h1>

        <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft">
          เช็คชื่อ · กรอกคะแนน · สร้างการบ้าน · ดูผลการเรียน — ครบในที่เดียว
          สำหรับครู นักเรียน และผู้ดูแลระบบ
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/login" className="btn-primary">
            เข้าสู่ระบบ
            <span aria-hidden>→</span>
          </Link>
          <Link href="/signup" className="btn-secondary">
            สมัครสมาชิก (นักเรียน)
          </Link>
          <a href="#roles" className="btn-ghost">
            เรียนรู้เพิ่มเติม
          </a>
        </div>

        <section id="roles" className="mt-20 grid gap-4 sm:grid-cols-3">
          <RoleCard
            icon={<GraduationCap className="h-6 w-6 text-ink-soft" />}
            title="นักเรียน"
            desc="ดูคะแนน · ส่งการบ้าน · ตรวจสอบผลการเรียนรายเทอม"
          />
          <RoleCard
            icon={<Sparkles className="h-6 w-6 text-accent" />}
            title="ครู"
            desc="จัดการห้องเรียน · เช็คชื่อ · ตรวจงาน · กรอกคะแนน"
          />
          <RoleCard
            icon={<ShieldCheck className="h-6 w-6 text-ink-soft" />}
            title="ผู้ดูแลระบบ"
            desc="ตรวจ audit log · จัดการบัญชีครู · รายงานสถิติ"
          />
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-3">
          <div className="stat">
            <div className="stat-label">บทบาทผู้ใช้</div>
            <div className="stat-value">3</div>
          </div>
          <div className="stat">
            <div className="stat-label">เกรดเฉลี่ย (ตัวอย่าง)</div>
            <div className="stat-value-gold">3.75</div>
          </div>
          <div className="stat">
            <div className="stat-label">มาตรฐาน</div>
            <div className="stat-value">PDPA</div>
          </div>
        </section>

        <footer className="mt-20 border-t border-slate-200 pt-6 text-xs text-ink-soft">
          Design system: Ink + Gold · ดู{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5">CLAUDE.md</code>
        </footer>
      </div>
    </main>
  );
}

function RoleCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="card sheen animate-slide-up p-6">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50">
        {icon}
      </div>
      <h3 className="font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{desc}</p>
    </div>
  );
}
