import { db } from "@/lib/db/client";
import { PaginationLinks } from "@/components/pagination";

interface PageProps {
  searchParams: Promise<{
    action?: string;
    actorId?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 30;

export default async function AdminAuditPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const action = sp.action ?? "";
  const actorId = sp.actorId ?? "";

  const where = {
    ...(action ? { action } : {}),
    ...(actorId ? { actorId } : {}),
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
        ipAddress: true,
        reason: true,
        actor: { select: { identifier: true } },
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

  return (
    <div className="animate-fade-in p-6 md:p-10 space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
        <p className="mt-1 text-sm text-ink-soft">
          กิจกรรมที่ตรวจสอบได้ทั้งหมด · เก็บ 2 ปีการศึกษา ·{" "}
          {total.toLocaleString("th-TH")} รายการ
        </p>
      </div>

      <form method="get" className="card p-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px]">
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
          <button type="submit" className="btn-secondary">
            กรอง
          </button>
          {action && (
            <a href="/admin/audit" className="btn-ghost btn-sm">
              ล้าง
            </a>
          )}
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th className="whitespace-nowrap">เวลา</th>
              <th>Event</th>
              <th>ผู้กระทำ</th>
              <th>Target</th>
              <th>IP</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-10 text-center text-sm text-ink-soft"
                >
                  ไม่มีรายการตาม filter
                </td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.id}>
                  <td className="whitespace-nowrap text-xs text-ink-soft">
                    {dateFmt.format(it.timestamp)}
                  </td>
                  <td>
                    <code className="text-xs">{it.action}</code>
                  </td>
                  <td className="text-sm">
                    {it.actor?.identifier ?? "—"}
                    {it.actorRole && (
                      <div className="text-[10px] text-ink-soft">
                        {it.actorRole}
                      </div>
                    )}
                  </td>
                  <td className="text-xs font-mono text-ink-soft">
                    {it.targetType
                      ? `${it.targetType}:${it.targetId ?? "—"}`
                      : "—"}
                  </td>
                  <td className="text-xs font-mono text-ink-soft">
                    {it.ipAddress ?? "—"}
                  </td>
                  <td className="text-xs text-ink-soft max-w-[200px] truncate">
                    {it.reason ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PaginationLinks
        basePath="/admin/audit"
        page={page}
        pageCount={pageCount}
        searchParams={{ action }}
      />
    </div>
  );
}
