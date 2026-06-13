import { FileText } from "lucide-react";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

const dueDateFmt = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  timeZone: "Asia/Bangkok",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AdminCourseAssignmentsPage({
  params,
}: PageProps) {
  const { id } = await params;
  const assignments = await db.assignment.findMany({
    where: { courseOfferingId: id },
    select: {
      id: true,
      title: true,
      dueAt: true,
      isScored: true,
      submissionClosed: true,
      autoCloseAtDue: true,
      createdAt: true,
      scoreItem: { select: { publishedAt: true } },
      _count: { select: { submissions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="card p-6">
      <div className="mb-4">
        <h2 className="text-lg font-medium tracking-tight text-black">
          งานในรายวิชา
        </h2>
        <p className="mt-1 text-xs text-ink-soft">
          {assignments.length === 0
            ? "ยังไม่มีงาน"
            : `${assignments.length.toLocaleString("th-TH")} รายการ · อ่านอย่างเดียว`}
        </p>
      </div>

      {assignments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 p-8 text-center">
          <FileText className="mx-auto h-7 w-7 text-black/30" />
          <p className="mt-3 text-sm text-ink-soft">ยังไม่มีงานในรายวิชานี้</p>
        </div>
      ) : (
        <ul className="divide-y divide-black/[0.06]">
          {assignments.map((assignment) => {
            const publishedScore =
              assignment.isScored && assignment.scoreItem?.publishedAt !== null;
            return (
              <li
                key={assignment.id}
                className="-mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-black">
                      {assignment.title}
                    </p>
                    {assignment.isScored && (
                      <span className="badge-gold">นับคะแนน</span>
                    )}
                    {publishedScore && (
                      <span className="rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm ring-1 ring-black/10">
                        คะแนนเผยแพร่แล้ว
                      </span>
                    )}
                    {assignment.submissionClosed && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                        ปิดการส่ง
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-ink-soft">
                    กำหนดส่ง:{" "}
                    {assignment.dueAt
                      ? dueDateFmt.format(assignment.dueAt)
                      : "ส่งเมื่อพร้อม"}
                    {assignment.autoCloseAtDue && assignment.dueAt
                      ? " · ปิดอัตโนมัติ"
                      : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-ink-soft">
                  {assignment._count.submissions.toLocaleString("th-TH")}{" "}
                  ส่งแล้ว
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
