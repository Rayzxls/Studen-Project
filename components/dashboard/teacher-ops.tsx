import {
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
} from "lucide-react";
import type {
  AttendanceTodayRow,
  ClassHealthRow,
  ReviewQueueItem,
} from "@/lib/dashboard/action-center";
import { CourseColorChip } from "@/components/course/course-color-chip";
import {
  ActionRow,
  EmptyState,
  SectionHeader,
} from "@/components/dashboard/primitives";

/**
 * Teacher operating blocks — Phase 11 dashboard reshape.
 * Answers "ห้องไหนต้องดูแลตอนนี้": review queue first (the largest pile
 * wins), attendance state for today's slots, then a per-course health
 * scan. Presentational only; the page fetches data once.
 */

export function ReviewQueueBlock({ items }: { items: ReviewQueueItem[] }) {
  return (
    <section className="card p-5">
      <SectionHeader
        title="คิวงานรอตรวจ"
        count={items.reduce((s, it) => s + it.pendingCount, 0) || undefined}
      />
      {items.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="ตรวจครบทุกชิ้นแล้ว"
          hint="งานที่นักเรียนส่งใหม่จะเข้าคิวที่นี่"
        />
      ) : (
        <div className="-mx-3">
          {items.map((it) => (
            <ActionRow
              key={it.assignmentId}
              href={`/teacher/courses/${it.courseId}/assignments/${it.assignmentId}?filter=pending`}
              title={it.title}
              meta={`${it.courseName} · ห้อง ${it.className}`}
              leading={<CourseColorChip classId={it.classId} variant="dot" />}
              trailing={
                <span className="inline-flex rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-700">
                  {it.pendingCount} ชิ้น
                </span>
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function AttendanceTodayBlock({ rows }: { rows: AttendanceTodayRow[] }) {
  return (
    <section className="card p-5">
      <SectionHeader title="เช็คชื่อวันนี้" count={rows.length || undefined} />
      {rows.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="วันนี้ไม่มีคาบตามตาราง"
          hint="คาบเรียนจากตารางสอนจะแสดงที่นี่ในวันสอน"
        />
      ) : (
        <div className="-mx-3">
          {rows.map((r) => (
            <ActionRow
              key={`${r.courseId}-${r.startTime}`}
              href={`/teacher/courses/${r.courseId}/attendance`}
              title={r.courseName}
              meta={
                <>
                  <span className="font-mono">{r.startTime}</span>–
                  <span className="font-mono">{r.endTime}</span> · ห้อง{" "}
                  {r.className}
                  {r.location ? ` · ${r.location}` : ""}
                </>
              }
              leading={<CourseColorChip classId={r.classId} variant="dot" />}
              trailing={<AttendanceStatusBadge row={r} />}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function AttendanceStatusBadge({ row }: { row: AttendanceTodayRow }) {
  if (row.status === "MARKED") {
    return (
      <span className="inline-flex rounded-full bg-green-50 px-2.5 py-0.5 text-[11px] font-medium text-green-700">
        เช็คแล้ว {row.markedCount}/{row.activeStudents}
      </span>
    );
  }
  if (row.status === "OPENED") {
    return (
      <span className="inline-flex rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-medium text-orange-700">
        เปิดคาบแล้ว · ยังไม่เช็ค
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-black/[0.05] px-2.5 py-0.5 text-[11px] font-medium text-black/55">
      ยังไม่เช็คชื่อ
    </span>
  );
}

export function ClassHealthBlock({ rows }: { rows: ClassHealthRow[] }) {
  return (
    <section className="card p-5">
      <SectionHeader title="สุขภาพรายวิชา" />
      {rows.length === 0 ? (
        <EmptyState
          icon={Gauge}
          title="ยังไม่มีวิชาในเทอมนี้"
          hint="สร้างวิชาแรกเพื่อเริ่มติดตามการส่งงานและการเช็คชื่อ"
          action={{ href: "/teacher/courses/new", label: "สร้างวิชา" }}
        />
      ) : (
        <ul className="divide-y divide-black/[0.05]">
          {rows.map((c) => (
            <li key={c.courseId}>
              <ActionRow
                href={`/teacher/courses/${c.courseId}/overview`}
                title={c.courseName}
                meta={
                  <>
                    ห้อง {c.className} · {c.activeStudents} คน
                    {c.draftScoreItems > 0 &&
                      ` · คะแนนยังไม่ประกาศ ${c.draftScoreItems} รายการ`}
                  </>
                }
                leading={<CourseColorChip classId={c.classId} variant="dot" />}
                trailing={
                  <span className="flex items-center gap-2">
                    {c.submitRate !== null && (
                      <SubmitRateBar percent={c.submitRate} />
                    )}
                    {c.pendingReview > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700">
                        <ClipboardCheck
                          className="h-3 w-3"
                          aria-hidden="true"
                        />
                        {c.pendingReview}
                      </span>
                    )}
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-black/40">
        แถบ % = สัดส่วนการส่งงานของทั้งห้อง · ตัวเลขส้ม = งานรอตรวจ
      </p>
    </section>
  );
}

function SubmitRateBar({ percent }: { percent: number }) {
  const tone =
    percent >= 80
      ? "bg-green-500"
      : percent >= 50
        ? "bg-orange-500"
        : "bg-red-500";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-black/[0.07]">
        <span
          className={`block h-full rounded-full ${tone}`}
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className="text-[11px] tabular-nums text-black/55">{percent}%</span>
    </span>
  );
}
