import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit/log";
import { requireRole } from "@/lib/auth/guards";
import { Unauthorized, Forbidden, HttpError } from "@/lib/errors";
import { getRequestMeta } from "@/lib/utils/request";
import { actionsForTier, type AuditTier } from "@/lib/audit/tier";

/**
 * GET /admin/audit/export — Phase 8 · Q3 = C
 *
 * Streams a CSV download with the same filters the viewer accepts.
 * Admin-only. Each export writes one `ADMIN_AUDIT_EXPORTED` Important
 * audit row capturing the filter snapshot — tamper-resistant audit of
 * the audit reader, per Security.md § 7.
 *
 * Hard cap at `MAX_ROWS` so a wide-open filter cannot exhaust the
 * Node process; the export response includes a `truncated: true`
 * header when capped so the admin knows to narrow further.
 */

const MAX_ROWS = 50_000;
const VALID_TIERS = new Set<AuditTier>(["CRITICAL", "IMPORTANT", "VERBOSE"]);

function parseTier(raw: string | null): AuditTier | null {
  if (!raw) return null;
  const up = raw.toUpperCase();
  return VALID_TIERS.has(up as AuditTier) ? (up as AuditTier) : null;
}

function bangkokLocalToUtc(raw: string | null): Date | null {
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

const CSV_HEADER = [
  "id",
  "timestamp",
  "action",
  "actorRole",
  "actorIdentifier",
  "targetType",
  "targetId",
  "ipAddress",
  "userAgent",
  "reason",
  "before",
  "after",
].join(",");

/**
 * Escape a single CSV field per RFC 4180 — double-quote wrap + escape
 * inner double quotes by doubling them.
 */
function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (s.length === 0) return "";
  // Always quote — Thai text + JSON payloads guarantee commas / newlines.
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  let session;
  try {
    session = await requireRole(["ADMIN"]);
  } catch (err) {
    if (err instanceof Unauthorized) {
      return new Response("unauthorized", { status: 401 });
    }
    if (err instanceof Forbidden) {
      return new Response("forbidden", { status: 403 });
    }
    throw err;
  }
  const meta = await getRequestMeta();

  const url = new URL(req.url);
  const action = (url.searchParams.get("action") ?? "").trim();
  const actorId = (url.searchParams.get("actorId") ?? "").trim();
  const actorQ = (url.searchParams.get("actor") ?? "").trim();
  const targetQ = (url.searchParams.get("target") ?? "").trim();
  const tier = parseTier(url.searchParams.get("tier"));
  const from = bangkokLocalToUtc(url.searchParams.get("from"));
  const to = bangkokLocalToUtc(url.searchParams.get("to"));

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

  let rows;
  try {
    rows = await db.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: MAX_ROWS,
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
        actor: { select: { identifier: true } },
      },
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return new Response(err.message, { status: err.status });
    }
    throw err;
  }

  // Write the export-was-performed audit row. Reason captures the
  // filter snapshot so a future audit-of-the-audit shows what was
  // pulled.
  const filterSnapshot = {
    action: action || null,
    actorId: actorId || null,
    actor: actorQ || null,
    target: targetQ || null,
    tier: tier ?? null,
    from: from?.toISOString() ?? null,
    to: to?.toISOString() ?? null,
    rowCount: rows.length,
    truncated: rows.length === MAX_ROWS,
  };
  await audit({
    actorId: session.user.id,
    actorRole: "ADMIN",
    action: "ADMIN_AUDIT_EXPORTED",
    targetType: "AuditLog",
    after: filterSnapshot,
    ipAddress: meta.ipAddress ?? undefined,
    userAgent: meta.userAgent ?? undefined,
  });

  const lines: string[] = [CSV_HEADER];
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.id),
        csvEscape(r.timestamp.toISOString()),
        csvEscape(r.action),
        csvEscape(r.actorRole),
        csvEscape(r.actor?.identifier),
        csvEscape(r.targetType),
        csvEscape(r.targetId),
        csvEscape(r.ipAddress),
        csvEscape(r.userAgent),
        csvEscape(r.reason),
        csvEscape(r.before),
        csvEscape(r.after),
      ].join(",")
    );
  }
  const body = lines.join("\r\n");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-${stamp}.csv"`,
      "X-Audit-Row-Count": String(rows.length),
      "X-Audit-Truncated": rows.length === MAX_ROWS ? "true" : "false",
    },
  });
}
