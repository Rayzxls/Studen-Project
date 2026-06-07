import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db/client";
import { tierForRow, type AuditTier } from "@/lib/audit/tier";

/**
 * Admin Audit detail — Phase 8 · Q2 = A (shareable URL drill-down).
 *
 * One audit row + actor info + target meta + full payload (before/
 * after JSON pretty-printed) + reason. Routes from the row's "ดู →"
 * link on /admin/audit. Layout follows the Calm Ledger card posture
 * established in Phase 5+.
 *
 * No mutation on this page — read-only forensic surface. Tamper
 * resistance per Security.md § 7 ("Admin ไม่สามารถลบ audit log ผ่าน
 * UI") means there is intentionally no delete affordance.
 */

interface PageProps {
  params: Promise<{ id: string }>;
}

function tierBadgeClass(tier: AuditTier): string {
  if (tier === "CRITICAL") return "bg-red-50 text-red-700 ring-1 ring-red-200";
  if (tier === "IMPORTANT")
    return "bg-orange-50 text-orange-700 ring-1 ring-orange-200";
  return "bg-black/[0.04] text-black/60";
}

function prettyJson(v: unknown): string {
  if (v === null || v === undefined) return "—";
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export default async function AdminAuditDetailPage({ params }: PageProps) {
  const { id } = await params;

  const row = await db.auditLog.findUnique({
    where: { id },
    select: {
      id: true,
      timestamp: true,
      action: true,
      actorRole: true,
      targetType: true,
      targetId: true,
      ipAddress: true,
      userAgent: true,
      reason: true,
      before: true,
      after: true,
      actor: { select: { id: true, identifier: true, role: true } },
    },
  });
  if (!row) notFound();

  const beforeScope = (() => {
    const b = row.before;
    if (b && typeof b === "object" && !Array.isArray(b)) {
      const v = (b as Record<string, unknown>).scope;
      return typeof v === "string" ? v : null;
    }
    return null;
  })();
  const tier = tierForRow({
    action: row.action,
    actorRole: row.actorRole,
    beforeScope,
  });

  const dateFmt = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="animate-fade-in space-y-5 p-6 md:p-10">
      <Link
        href="/admin/audit"
        className="inline-flex items-center gap-1 text-xs text-black/60 hover:text-black"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        กลับไปรายการ Audit
      </Link>

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-ink-soft">
              {dateFmt.format(row.timestamp)} (Asia/Bangkok)
            </p>
            <h1 className="mt-1 font-mono text-2xl font-medium text-black md:text-3xl">
              {row.action}
            </h1>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tierBadgeClass(tier)}`}
          >
            {tier}
          </span>
        </div>

        <dl className="mt-6 grid gap-x-6 gap-y-4 md:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-ink-soft">ผู้กระทำ</dt>
            <dd className="mt-1 text-sm text-black">
              {row.actor?.identifier ?? "—"}
              {row.actorRole && (
                <span className="ml-2 rounded bg-black/[0.05] px-1.5 py-0.5 text-[10px] text-black/60">
                  {row.actorRole}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-ink-soft">Target</dt>
            <dd className="mt-1 font-mono text-xs text-black">
              {row.targetType ? (
                <>
                  {row.targetType}
                  {row.targetId && (
                    <>
                      <span className="text-black/40">:</span>
                      {row.targetId}
                    </>
                  )}
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-ink-soft">IP</dt>
            <dd className="mt-1 font-mono text-xs text-black/80">
              {row.ipAddress ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-ink-soft">User-Agent</dt>
            <dd className="mt-1 max-w-md truncate font-mono text-xs text-black/60">
              {row.userAgent ?? "—"}
            </dd>
          </div>
          {row.reason && (
            <div className="md:col-span-2">
              <dt className="text-xs font-medium text-ink-soft">Reason</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-black/80">
                {row.reason}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-medium text-black">Before</h2>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-black/[0.03] p-3 font-mono text-[11px] text-black/80">
            {prettyJson(row.before)}
          </pre>
        </div>
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-medium text-black">After</h2>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-black/[0.03] p-3 font-mono text-[11px] text-black/80">
            {prettyJson(row.after)}
          </pre>
        </div>
      </div>
    </div>
  );
}
