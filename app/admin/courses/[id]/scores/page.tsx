import Link from "next/link";
import { CheckCircle2, FileText } from "lucide-react";
import { db } from "@/lib/db/client";
import { gradeForCourseOffering, scoreTotal } from "@/lib/scoring/calc";
import { formatPercent } from "@/lib/scoring/format";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminCourseScoresPage({ params }: PageProps) {
  const { id } = await params;
  const [items, enrollments] = await Promise.all([
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
    db.enrollment.findMany({
      where: {
        courseOfferingId: id,
        OR: [
          { removedAt: null },
          { scoreEntries: { some: { scoreItem: { courseOfferingId: id } } } },
        ],
      },
      select: {
        id: true,
        removedAt: true,
        student: {
          select: {
            userId: true,
            studentId: true,
            firstName: true,
            lastName: true,
          },
        },
        scoreEntries: {
          where: { scoreItem: { courseOfferingId: id } },
          select: { scoreItemId: true, value: true },
        },
      },
      orderBy: [
        { student: { firstName: "asc" } },
        { student: { lastName: "asc" } },
      ],
    }),
  ]);

  const publishedItems = items.filter((item) => item.publishedAt !== null);
  const publishedFullScore = publishedItems.reduce(
    (sum, item) => sum + Math.max(0, item.fullScore),
    0
  );

  return (
    <div className="space-y-4">
      <section className="card p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium tracking-tight text-black">
              คะแนนและเกรดรายวิชา
            </h2>
            <p className="mt-1 text-xs text-ink-soft">
              แยกให้เห็นว่าแต่ละคนได้คะแนนจากส่วนไหนบ้าง ·
              คะแนนรวมคิดจากรายการที่ประกาศแล้ว
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
              ประกาศแล้ว {publishedItems.length}/{items.length} รายการ
            </span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-500/10">
              คะแนนเต็มที่ประกาศ {publishedFullScore}
            </span>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/15 p-8 text-center text-sm text-ink-soft">
            ยังไม่มีรายการคะแนนในรายวิชานี้
          </div>
        ) : enrollments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/15 p-8 text-center text-sm text-ink-soft">
            ยังไม่มีนักเรียนให้แสดงคะแนน
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-black/[0.08]">
            <table className="table w-full min-w-[900px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-surface">นักเรียน</th>
                  {items.map((item) => (
                    <th key={item.id} className="text-right">
                      <span className="block max-w-[140px] truncate">
                        {item.name}
                      </span>
                      <span className="mt-0.5 block text-[10px] font-normal text-ink-soft">
                        /{item.fullScore} ·{" "}
                        {item.publishedAt ? "ประกาศแล้ว" : "ร่าง"}
                      </span>
                    </th>
                  ))}
                  <th className="text-right">คะแนนรวม</th>
                  <th className="text-right">%</th>
                  <th className="text-right">เกรด</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((enrollment) => {
                  const entries = enrollment.scoreEntries.map((entry) => ({
                    scoreItemId: entry.scoreItemId,
                    value: entry.value,
                  }));
                  const entryByItem = new Map(
                    entries.map((entry) => [entry.scoreItemId, entry.value])
                  );
                  const scoreSum = publishedItems.reduce((sum, item) => {
                    if (item.fullScore <= 0) return sum;
                    return sum + (entryByItem.get(item.id) ?? 0);
                  }, 0);
                  const percent = scoreTotal(items, entries);
                  const grade = gradeForCourseOffering(items, entries);

                  return (
                    <tr key={enrollment.id}>
                      <td className="sticky left-0 z-10 bg-surface">
                        <Link
                          href={`/admin/users/${enrollment.student.userId}`}
                          className="font-medium text-black hover:underline"
                        >
                          {enrollment.student.firstName}{" "}
                          {enrollment.student.lastName}
                        </Link>
                        <p className="mt-0.5 font-mono text-[10px] text-ink-soft">
                          {enrollment.student.studentId}
                          {enrollment.removedAt && " · ออกจากรายวิชาแล้ว"}
                        </p>
                      </td>
                      {items.map((item) => {
                        const value = entryByItem.get(item.id);
                        return (
                          <td
                            key={item.id}
                            className={
                              "text-right text-sm " +
                              (item.publishedAt ? "" : "text-ink-soft")
                            }
                          >
                            {value ?? "—"}
                          </td>
                        );
                      })}
                      <td className="text-right text-sm font-medium">
                        {scoreSum}/{publishedFullScore || 0}
                      </td>
                      <td className="text-right text-sm">
                        {percent === null ? "—" : formatPercent(percent)}
                      </td>
                      <td className="text-right text-sm font-semibold text-blue-600">
                        {grade.grade === null ? "—" : grade.grade.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {items.length > 0 && (
        <section className="card p-6">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-black">
            <FileText className="h-4 w-4 text-blue-600" />
            รายการคะแนนทั้งหมด
          </h2>
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
        </section>
      )}
    </div>
  );
}
