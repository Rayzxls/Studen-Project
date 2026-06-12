import { Ban, CalendarClock } from "lucide-react";
import { listSessions } from "@/lib/attendance/session";
import { formatSessionHeader } from "@/lib/attendance/format";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminCourseAttendancePage({ params }: PageProps) {
  const { id } = await params;
  const sessions = await listSessions(id, { limit: 100 });

  return (
    <div className="card p-6">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-lg font-medium tracking-tight text-black">
          <CalendarClock className="h-5 w-5 text-blue-600" />
          คาบเรียน
        </h2>
        <p className="mt-1 text-xs text-ink-soft">
          ทั้งหมด {sessions.length.toLocaleString("th-TH")} คาบ · อ่านอย่างเดียว
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 p-8 text-center">
          <p className="text-sm text-ink-soft">ยังไม่มีคาบเรียน</p>
        </div>
      ) : (
        <ul className="divide-y divide-black/[0.06]">
          {sessions.map((session) => (
            <li
              key={session.id}
              className={
                "-mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-3 " +
                (session.cancelledAt ? "opacity-60" : "")
              }
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-black">
                  {formatSessionHeader(
                    session.scheduledStart,
                    session.scheduledEnd
                  )}
                  {session.cancelledAt && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700">
                      <Ban className="h-3 w-3" />
                      ยกเลิก
                    </span>
                  )}
                  {!session.timetableSlotId && !session.cancelledAt && (
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                      ad-hoc
                    </span>
                  )}
                </p>
                {session.note && (
                  <p className="mt-0.5 truncate text-xs text-ink-soft">
                    {session.note}
                  </p>
                )}
                {session.cancelledAt && session.cancelledReason && (
                  <p className="mt-0.5 truncate text-xs text-red-700/70">
                    เหตุผล: {session.cancelledReason}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right text-xs text-ink-soft">
                {session._count.records.toLocaleString("th-TH")} รายการ
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
