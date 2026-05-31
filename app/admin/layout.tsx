import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { signOut } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin-sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireRole(["ADMIN"]);
  } catch {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="flex items-center justify-between px-4 md:px-6 py-3">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-2"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white">
              S
            </div>
            <div className="leading-tight">
              <div className="text-xs font-medium text-ink-soft">
                Admin Panel
              </div>
              <div className="text-sm font-semibold">Studennnn</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <span className="badge-admin hidden sm:inline-flex">
              ผู้ดูแลระบบ
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button className="btn-ghost btn-sm">ออกจากระบบ</button>
            </form>
          </div>
        </div>
      </header>

      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
