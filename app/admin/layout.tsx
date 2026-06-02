import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { signOut } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin-sidebar";

function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 256 256"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M 128.005 191.173 C 128.448 156.208 156.93 128 192 128 L 192 64 L 128 64 C 128 99.346 99.346 128 64 128 L 64 192 L 128 192 Z M 192 256 L 64 256 C 28.654 256 0 227.346 0 192 L 0 64 L 64 64 L 64 0 L 192 0 C 227.346 0 256 28.654 256 64 L 256 192 L 192 192 Z" />
    </svg>
  );
}

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
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-white/80 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-2"
          >
            <LogoMark className="h-6 w-6 text-black" />
            <div className="leading-tight">
              <div className="text-xs font-medium text-black/60">
                Admin Panel
              </div>
              <div
                className="text-sm font-medium text-black"
                style={{ letterSpacing: "-0.01em" }}
              >
                Studennnn
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <span className="badge hidden sm:inline-flex">ผู้ดูแลระบบ</span>
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
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
