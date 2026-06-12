import { CheckCircle2, FileText } from "lucide-react";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminCourseScoresPage({ params }: PageProps) {
  const { id } = await params;
  const [items, activeMemberCount] = await Promise.all([
    db.scoreItem.findMany({
      where: { courseOfferingId: id },
      select: {
        id: true,
        name: true,
        fullScore: true,
        position: true,
        publishedAt: true,
        _count: { select: { entries: true } },
      },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    }),
    db.enrollment.count({ where: { courseOfferingId: id, removedAt: null } }),
  ]);

  const publishedCount = items.filter(
    (item) => item.publishedAt !== null
  ).length;
  const fullScoreSum = items.reduce((sum, item) => sum + item.fullScore, 0);

  return (
    <div className="card p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium tracking-tight text-black">
            รายการคะแนน
          </h2>
          <p className="mt-1 text-xs text-ink-soft">
            {items.length === 0
              ? "ยังไม่มีรายการคะแนน"
              : `${items.length} รายการ · ${publishedCount} เผยแพร่แล้ว · นักเรียน ${activeMemberCount} คน`}
          </p>
        </div>
        <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
          คะแนนเต็มรวม {fullScoreSum}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 p-8 text-center text-sm text-ink-soft">
          ยังไม่มีรายการคะแนนในรายวิชานี้
        </div>
      ) : (
        <ul className="divide-y divide-black/[0.06]">
          {items.map((item) => {
            const published = item.publishedAt !== null;
            return (
              <li
                key={item.id}
                className="-mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-medium text-black">
                    <FileText className="h-4 w-4 shrink-0 text-black/30" />
                    {item.name}
                    {published ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm ring-1 ring-black/10">
                        <CheckCircle2 className="h-3 w-3" />
                        เผยแพร่แล้ว
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                        ร่าง
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    คะแนนเต็ม {item.fullScore} · บันทึกคะแนนแล้ว{" "}
                    {item._count.entries.toLocaleString("th-TH")} รายการ
                  </p>
                </div>
                <span className="text-xs text-ink-soft">
                  ลำดับ {item.position}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
