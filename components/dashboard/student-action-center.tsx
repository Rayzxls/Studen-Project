import Link from "next/link";
import { CalendarClock, CheckCircle2, RotateCcw, Award } from "lucide-react";
import type {
  StudentDueItem,
  StudentRecentScore,
  StudentReturnedItem,
} from "@/lib/dashboard/action-center";
import { formatThaiDateShort } from "@/lib/attendance/format";
import {
  ActionRow,
  EmptyState,
  SectionHeader,
} from "@/components/dashboard/primitives";

/**
 * Student Action Center — the main block of the student dashboard.
 * Answers "วันนี้ต้องจัดการอะไร" in priority order: returned work first
 * (the teacher is waiting), then due work, then fresh scores as a
 * compact aside list. Presentational only; the page fetches data once.
 */

export function ReturnedWorkBlock({ items }: { items: StudentReturnedItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-red-50 text-red-700">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2
            className="text-base font-semibold text-black"
            style={{ letterSpacing: "-0.01em" }}
          >
            ครูส่งคืนให้แก้
            <span className="ml-1.5 text-sm font-normal text-black/40">
              {items.length}
            </span>
          </h2>
          <p className="text-xs text-black/50">
            อ่านคำแนะนำของครู แก้ไขแล้วส่งใหม่
          </p>
        </div>
      </div>
      <div className="-mx-3">
        {items.map((it) => (
          <ActionRow
            key={it.assignmentId}
            href={`/student/courses/${it.courseId}/assignments/${it.assignmentId}`}
            title={it.title}
            meta={it.courseName}
            trailing={
              <span className="badge badge-danger">แก้แล้วส่งใหม่</span>
            }
          />
        ))}
      </div>
    </section>
  );
}

export function DueWorkBlock({ items }: { items: StudentDueItem[] }) {
  return (
    <section className="card p-5">
      <SectionHeader title="งานต้องส่ง" count={items.length} />
      {items.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="ไม่มีงานค้าง"
          hint="งานใหม่จากครูจะแสดงที่นี่พร้อมกำหนดส่ง"
        />
      ) : (
        <div className="-mx-3">
          {items.map((it) => (
            <ActionRow
              key={it.assignmentId}
              href={`/student/courses/${it.courseId}/assignments/${it.assignmentId}`}
              title={it.title}
              meta={
                <>
                  {it.courseName}
                  {it.hasDraft && " · มีร่างที่ยังไม่ส่ง"}
                </>
              }
              trailing={<DueChip dueAt={it.dueAt} isOverdue={it.isOverdue} />}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function DueChip({
  dueAt,
  isOverdue,
}: {
  dueAt: Date | null;
  isOverdue: boolean;
}) {
  if (dueAt === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] text-black/55">
        ส่งเมื่อพร้อม
      </span>
    );
  }
  if (isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
        <CalendarClock className="h-3 w-3" aria-hidden="true" />
        เลยกำหนด · {formatThaiDateShort(dueAt)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
      <CalendarClock className="h-3 w-3" aria-hidden="true" />
      {formatThaiDateShort(dueAt)}
    </span>
  );
}

export function RecentScoresBlock({ items }: { items: StudentRecentScore[] }) {
  return (
    <section className="card p-5">
      <SectionHeader
        title="คะแนนล่าสุด"
        action={{ href: "/student/terms", label: "ผลการเรียน" }}
      />
      {items.length === 0 ? (
        <EmptyState
          icon={Award}
          title="ยังไม่มีคะแนนประกาศ"
          hint="เมื่อครูประกาศคะแนน จะเห็นที่นี่ทันที"
        />
      ) : (
        <ul className="divide-y divide-black/[0.05]">
          {items.map((s) => (
            <li key={s.scoreItemId}>
              <Link
                href={`/student/courses/${s.courseId}/scores`}
                className="flex min-h-11 items-center justify-between gap-3 py-2.5 hover:no-underline"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-black">
                    {s.itemName}
                  </span>
                  <span className="block truncate text-xs text-black/50">
                    {s.courseName}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-blue-700">
                  {s.value !== null ? s.value : "—"}
                  <span className="font-normal text-black/40">
                    /{s.fullScore}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
