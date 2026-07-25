import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { identityFoundationMutationsEnabled } from "@/lib/identity/feature-flags";
import { listRecentTeacherInvites } from "@/lib/identity/teacher-invite-read";
import { TeacherInvitePanel } from "@/components/admin/teacher-invite-panel";

export const dynamic = "force-dynamic";

export default async function AdminTeacherInvitesPage() {
  // Additive, flag-gated surface: it does not exist until identity is on.
  if (!identityFoundationMutationsEnabled()) {
    notFound();
  }

  const invites = await listRecentTeacherInvites();

  return (
    <div className="animate-fade-in space-y-5 p-6 md:p-10">
      <div>
        <Link
          href="/admin/teachers"
          className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          ครู
        </Link>
        <h1 className="mt-2 text-3xl font-medium tracking-tight">คำเชิญครู</h1>
        <p className="mt-1 text-sm text-ink-soft">
          เชิญครูด้วยอีเมล — ระบบสร้างเฉพาะคำเชิญ
          ไม่สร้างบัญชีหรือรหัสผ่านแทนครู
        </p>
      </div>

      <TeacherInvitePanel
        invites={invites.map((invite) => ({
          inviteId: invite.inviteId,
          email: invite.email,
          status: invite.status,
          expiresAt: invite.expiresAt.toISOString(),
          createdAt: invite.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
