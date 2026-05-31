import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db/client";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      identifier: true,
      createdAt: true,
      admin: { select: { firstName: true, lastName: true } },
      teacher: { select: { firstName: true, lastName: true, email: true } },
      student: { select: { firstName: true, lastName: true, studentId: true } },
    },
  });

  if (!user) redirect("/login");

  const name = user.admin
    ? `${user.admin.firstName} ${user.admin.lastName}`
    : user.teacher
      ? `${user.teacher.firstName} ${user.teacher.lastName}`
      : user.student
        ? `${user.student.firstName} ${user.student.lastName}`
        : user.identifier;

  const roleLabel: Record<typeof user.role, string> = {
    ADMIN: "ผู้ดูแลระบบ",
    TEACHER: "ครู",
    STUDENT: "นักเรียน",
  };

  const roleBadge: Record<typeof user.role, string> = {
    ADMIN: "badge-admin",
    TEACHER: "badge-teacher",
    STUDENT: "badge-student",
  };

  return (
    <div className="mesh-bg min-h-screen">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white">
              S
            </div>
            <span className="font-semibold">Studennnn</span>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="btn-ghost btn-sm">ออกจากระบบ</button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 animate-fade-in">
        <div className="mb-6 flex items-center gap-3">
          <span className={roleBadge[user.role]}>{roleLabel[user.role]}</span>
          <span className="text-sm text-ink-soft">
            สมาชิกตั้งแต่{" "}
            {new Intl.DateTimeFormat("th-TH", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }).format(user.createdAt)}
          </span>
        </div>

        <h1 className="text-3xl font-bold tracking-tight">
          สวัสดี, <span className="text-gradient-gold">{name}</span>
        </h1>
        <p className="mt-2 text-ink-soft">
          ยินดีต้อนรับเข้าสู่ระบบจัดการห้องเรียน Studennnn
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="stat">
            <div className="stat-label">บทบาท</div>
            <div className="stat-value">{roleLabel[user.role]}</div>
          </div>
          <div className="stat">
            <div className="stat-label">ผู้ใช้</div>
            <div className="stat-value text-2xl">{user.identifier}</div>
          </div>
          <div className="stat">
            <div className="stat-label">สถานะ</div>
            <div className="stat-value-gold">Phase 1</div>
          </div>
        </div>

        <div className="mt-10 card sheen p-6">
          <h2 className="font-semibold tracking-tight">🚧 อยู่ระหว่างพัฒนา</h2>
          <p className="mt-2 text-sm text-ink-soft">
            ตอนนี้ระบบอยู่ใน Phase 1 (Auth & RBAC). ฟีเจอร์อื่นๆ
            จะเพิ่มตามลำดับ:
          </p>
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-ink-soft">
            <li>Phase 2 — ข้อมูลวิชา + ห้องเรียน + Class Code/QR</li>
            <li>Phase 3 — สมาชิกห้อง</li>
            <li>Phase 4 — เช็คชื่อ</li>
            <li>Phase 5 — คะแนน + Term Summary</li>
            <li>Phase 6 — การบ้าน + Comments</li>
            <li>Phase 7 — Feed + Notifications</li>
            <li>Phase 8 — Admin Audit Tools</li>
            <li>Phase 9 — Polish + Hardening</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
