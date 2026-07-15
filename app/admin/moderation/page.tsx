import Link from "next/link";
import { redirect } from "next/navigation";
import { Flag, History, ShieldAlert } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { moderationCenterEnabled } from "@/lib/moderation/feature-flags";
import {
  getModerationQueue,
  type ModerationQueueFilter,
} from "@/lib/moderation/queries";

export const dynamic = "force-dynamic";

export default async function AdminModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  try {
    await requireRole(["ADMIN"]);
  } catch {
    redirect("/dashboard");
  }
  if (!moderationCenterEnabled()) redirect("/admin/dashboard");

  const { view } = await searchParams;
  const filter: ModerationQueueFilter =
    view === "history" ? "history" : view === "all" ? "all" : "active";
  const cases = await getModerationQueue(filter);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
            Admin · Safety
          </span>
          <h1 className="mt-2 text-2xl font-semibold text-black sm:text-3xl">
            Moderation Center
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            ตรวจรายงานแบบรวมเป็น Case เดียว จัดการการซ่อนชั่วคราว
            และเก็บหลักฐานการตัดสินแยกจาก Audit Log
          </p>
        </div>
        <Link href="/admin/audit" className="btn-secondary btn-sm">
          <History className="h-4 w-4" />
          เปิด Audit Log
        </Link>
      </header>

      <nav
        className="inline-flex w-full gap-1 overflow-x-auto rounded-xl bg-black/[0.04] p-1 sm:w-fit"
        aria-label="มุมมอง Case"
      >
        <QueueTab href="/admin/moderation" active={filter === "active"}>
          งานที่ต้องตรวจ
        </QueueTab>
        <QueueTab
          href="/admin/moderation?view=history"
          active={filter === "history"}
        >
          ประวัติการตัดสิน
        </QueueTab>
        <QueueTab href="/admin/moderation?view=all" active={filter === "all"}>
          ทั้งหมด
        </QueueTab>
      </nav>

      {cases.length === 0 ? (
        <div className="card grid min-h-64 place-items-center p-8 text-center">
          <div>
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-700">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-base font-semibold text-black">
              ไม่มี Case ในมุมมองนี้
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              รายงานใหม่จะปรากฏที่นี่โดยไม่ซ่อนเนื้อหาอัตโนมัติ
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {cases.map((item) => (
            <Link
              key={item.id}
              href={`/admin/moderation/${item.id}`}
              className="card group grid gap-4 p-4 hover:no-underline sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-5"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700">
                <Flag className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <strong className="truncate text-sm text-black">
                    {item.targetLabel}
                  </strong>
                  <StatusBadge status={item.status} />
                  {item.restrictionKind && (
                    <span className="badge badge-warn">
                      {item.restrictionKind === "HIDDEN"
                        ? "ซ่อนอยู่"
                        : "กักไว้"}
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-xs text-ink-soft">
                  {targetTypeLabel(item.targetType)} ·{" "}
                  {item.reports[0]?.category ?? "OTHER"}
                </span>
              </span>
              <span className="flex items-center gap-3 text-xs text-ink-soft sm:justify-end">
                <span>{item.reportCount} รายงาน</span>
                <span className="text-blue-700 group-hover:underline">
                  เปิด Case →
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function QueueTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium hover:no-underline " +
        (active
          ? "bg-surface text-black shadow-sm"
          : "text-ink-soft hover:text-black")
      }
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    OPEN: "ใหม่",
    IN_REVIEW: "กำลังตรวจ",
    APPEALED: "อุทธรณ์",
    RESOLVED: "ดำเนินการแล้ว",
    DISMISSED: "ยกคำร้อง",
  };
  return <span className="badge badge-info">{labels[status] ?? status}</span>;
}

function targetTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    COMMENT: "ความคิดเห็น",
    ANNOUNCEMENT: "ประกาศ",
    MATERIAL: "เอกสาร",
    ASSIGNMENT: "การบ้าน",
    FILE_ATTACHMENT: "ไฟล์แนบ",
    PROFILE_IMAGE: "รูปโปรไฟล์",
  };
  return labels[type] ?? type;
}
