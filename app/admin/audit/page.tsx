import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { PaginationLinks } from "@/components/pagination";
import { actionsForTier, tierForRow, type AuditTier } from "@/lib/audit/tier";
import { actionLabel } from "@/lib/audit/label";
import { renderAuditLog } from "@/lib/audit/render";

/**
 * Admin Audit viewer — Phase 8 · Q1 = A (pure-helper tier dispatch)
 *
 * Filters wired via searchParams (shareable URL, browser-back works):
 *   - action       — exact match against AuditLog.action
 *   - actorId      — exact match against AuditLog.actorId
 *   - actor        — substring match against User.identifier (FK join)
 *   - target       — substring match against targetType OR targetId
 *   - tier         — CRITICAL | IMPORTANT | VERBOSE (expands to action IN/NOT IN)
 *   - from / to    — Bangkok-local `YYYY-MM-DDTHH:mm`, converted to UTC at the edge
 *   - page         — 1-based
 *
 * Each row links to `/admin/audit/[id]` for the per-event drill-down
 * (Q2 = A). The CSV export button forwards the same querystring to
 * `/admin/audit/export` (Q3 = C, ships in Phase 8 too).
 */

interface PageProps {
  searchParams: Promise<{
    action?: string;
    actorId?: string;
    actor?: string;
    target?: string;
    tier?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 30;
const VALID_TIERS = new Set(["CRITICAL", "IMPORTANT", "VERBOSE"]);

function parseTier(raw: string | undefined): AuditTier | null {
  if (!raw) return null;
  const up = raw.toUpperCase();
  return VALID_TIERS.has(up) ? (up as AuditTier) : null;
}

/**
 * Parse a Bangkok-local datetime-local string (`YYYY-MM-DDTHH:mm`) into
 * a UTC Date. Returns null for invalid/empty input. Mirrors the
 * lib/attendance/format edge-helper posture (Asia/Bangkok = UTC+7
 * fixed, no DST).
 */
function bangkokLocalToUtc(raw: string | undefined): Date | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const localAsUtcMs = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi)
  );
  const utc = new Date(localAsUtcMs - 7 * 60 * 60 * 1000);
  return Number.isNaN(utc.getTime()) ? null : utc;
}

function tierBadgeClass(tier: AuditTier): string {
  if (tier === "CRITICAL") return "bg-red-50 text-red-700 ring-1 ring-red-200";
  if (tier === "IMPORTANT")
    return "bg-orange-50 text-orange-700 ring-1 ring-orange-200";
  return "bg-black/[0.04] text-black/60";
}

export default async function AdminAuditPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const action = (sp.action ?? "").trim();
  const actorId = (sp.actorId ?? "").trim();
  const actorQ = (sp.actor ?? "").trim();
  const targetQ = (sp.target ?? "").trim();
  const tier = parseTier(sp.tier);
  const from = bangkokLocalToUtc(sp.from);
  const to = bangkokLocalToUtc(sp.to);

  // Compose the WHERE clause. We intentionally use Prisma's relational
  // filter on `actor` for the substring search so Postgres can use the
  // User.identifier index.
  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action } : {}),
    ...(actorId ? { actorId } : {}),
    ...(actorQ
      ? { actor: { identifier: { contains: actorQ, mode: "insensitive" } } }
      : {}),
    ...(targetQ
      ? {
          OR: [
            { targetType: { contains: targetQ, mode: "insensitive" } },
            { targetId: { contains: targetQ, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(from || to
      ? {
          timestamp: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
    ...(tier === "CRITICAL"
      ? { action: { in: [...actionsForTier("CRITICAL")] } }
      : tier === "IMPORTANT"
        ? { action: { in: [...actionsForTier("IMPORTANT")] } }
        : tier === "VERBOSE"
          ? {
              action: {
                notIn: [
                  ...actionsForTier("CRITICAL"),
                  ...actionsForTier("IMPORTANT"),
                ],
              },
            }
          : {}),
  };

  const [total, items, distinctActions] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        timestamp: true,
        action: true,
        actorRole: true,
        targetType: true,
        targetId: true,
        targetLabel: true,
        ipAddress: true,
        reason: true,
        before: true,
        actor: {
          select: {
            identifier: true,
            teacher: { select: { firstName: true, lastName: true } },
            student: { select: { firstName: true, lastName: true } },
            admin: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    db.auditLog.groupBy({
      by: ["action"],
      orderBy: { action: "asc" },
    }),
  ]);

  const dateFmt = new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Re-build the querystring without `page` so the CSV export + paginator
  // forwards the active filters.
  const filterQs = new URLSearchParams();
  if (action) filterQs.set("action", action);
  if (actorId) filterQs.set("actorId", actorId);
  if (actorQ) filterQs.set("actor", actorQ);
  if (targetQ) filterQs.set("target", targetQ);
  if (tier) filterQs.set("tier", tier);
  if (sp.from) filterQs.set("from", sp.from);
  if (sp.to) filterQs.set("to", sp.to);
  const exportHref = `/admin/audit/export?${filterQs.toString()}`;

  return (
    <div className="animate-fade-in space-y-5 p-6 md:p-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Audit Log</h1>
          <p className="mt-1 text-sm text-ink-soft">
            กิจกรรมที่ตรวจสอบได้ทั้งหมด · เก็บ 2 ปีการศึกษา ·{" "}
            {total.toLocaleString("th-TH")} รายการ
          </p>
        </div>
        <a href={exportHref} className="btn-secondary btn-sm">
          ดาวน์โหลด CSV
        </a>
      </div>

      <form method="get" className="card space-y-3 p-4">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">
              ระดับ (Tier)
            </label>
            <select name="tier" defaultValue={tier ?? ""} className="input">
              <option value="">ทั้งหมด</option>
              <option value="CRITICAL">Critical</option>
              <option value="IMPORTANT">Important</option>
              <option value="VERBOSE">Verbose</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">
              ประเภท Event
            </label>
            <select name="action" defaultValue={action} className="input">
              <option value="">ทั้งหมด</option>
              {distinctActions.map((a) => (
                <option key={a.action} value={a.action}>
                  {a.action}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">
              ค้นหา Actor (identifier)
            </label>
            <input
              name="actor"
              defaultValue={actorQ}
              placeholder="เช่น admin@studennnn"
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">
              ค้นหา Target (type หรือ id)
            </label>
            <input
              name="target"
              defaultValue={targetQ}
              placeholder="เช่น ScoreItem"
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">
              ตั้งแต่ (เวลาไทย)
            </label>
            <input
              name="from"
              type="datetime-local"
              defaultValue={sp.from ?? ""}
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">
              ถึง (เวลาไทย)
            </label>
            <input
              name="to"
              type="datetime-local"
              defaultValue={sp.to ?? ""}
              className="input"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="btn-secondary btn-sm">
            กรอง
          </button>
          {(action ||
            actorId ||
            actorQ ||
            targetQ ||
            tier ||
            sp.from ||
            sp.to) && (
            <Link href="/admin/audit" className="btn-ghost btn-sm">
              ล้าง
            </Link>
          )}
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th className="whitespace-nowrap">เวลา</th>
              <th>Tier</th>
              <th>เหตุการณ์</th>
              <th>ผู้กระทำ</th>
              <th>เกิดอะไรขึ้น</th>
              <th>IP</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="py-10 text-center text-sm text-ink-soft"
                >
                  ไม่มีรายการตาม filter
                </td>
              </tr>
            ) : (
              items.map((it) => {
                const beforeScope = (() => {
                  const b = it.before;
                  if (b && typeof b === "object" && !Array.isArray(b)) {
                    const v = (b as Record<string, unknown>).scope;
                    return typeof v === "string" ? v : null;
                  }
                  return null;
                })();
                const rowTier = tierForRow({
                  action: it.action,
                  actorRole: it.actorRole,
                  beforeScope,
                });
                const actorName = it.actor?.teacher
                  ? `${it.actor.teacher.firstName} ${it.actor.teacher.lastName}`
                  : it.actor?.student
                    ? `${it.actor.student.firstName} ${it.actor.student.lastName}`
                    : it.actor?.admin
                      ? `${it.actor.admin.firstName} ${it.actor.admin.lastName}`
                      : (it.actor?.identifier ?? null);
                const sentence = renderAuditLog(it, actorName);
                return (
                  <tr key={it.id}>
                    <td className="whitespace-nowrap text-xs text-ink-soft">
                      {dateFmt.format(it.timestamp)}
                    </td>
                    <td>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${tierBadgeClass(rowTier)}`}
                      >
                        {rowTier}
                      </span>
                    </td>
                    <td>
                      <span
                        className="text-xs"
                        title={it.action /* technical name on hover */}
                      >
                        {actionLabel(
                          it.action as Parameters<typeof actionLabel>[0]
                        )}
                      </span>
                    </td>
                    <td className="text-sm">
                      {actorName ?? "—"}
                      {it.actorRole && (
                        <div className="text-[10px] text-ink-soft">
                          {it.actorRole}
                        </div>
                      )}
                    </td>
                    <td className="max-w-[420px] text-xs text-black/80">
                      {sentence}
                    </td>
                    <td className="font-mono text-xs text-ink-soft">
                      {it.ipAddress ?? "—"}
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/admin/audit/${it.id}`}
                        className="text-xs text-black hover:underline"
                      >
                        ดู →
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <PaginationLinks
        basePath="/admin/audit"
        page={page}
        pageCount={pageCount}
        searchParams={Object.fromEntries(filterQs.entries())}
      />
    </div>
  );
}
