import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { TopNav } from "@/components/layout/top-nav";
import { AdminSidebar } from "@/components/admin-sidebar";
import { moderationCenterEnabled } from "@/lib/moderation/feature-flags";

// Auth-gated DB-fetching layout — skip static prerender so CI build does
// not try to connect to a real Postgres at localhost:5432.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await requireRole(["ADMIN"]);
  } catch {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-bg">
      <TopNav session={session} showBell={false} showRoleBadge />

      <div className="flex">
        <AdminSidebar showModeration={moderationCenterEnabled()} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
