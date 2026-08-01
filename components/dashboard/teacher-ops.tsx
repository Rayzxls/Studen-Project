import Link from "next/link";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  ClipboardX,
  Gauge,
  TrendingDown,
  UserRoundSearch,
} from "lucide-react";
import type {
  AttendanceTodayRow,
  ClassHealthRow,
  ReviewQueueItem,
} from "@/lib/dashboard/action-center";
import { CourseColorChip } from "@/components/course/course-color-chip";
import type {
  EarlyWarningRow,
  EarlyWarningSignal,
} from "@/lib/early-warning/evaluate";
import type { TeacherEarlyWarningSummary } from "@/lib/early-warning/teacher";
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

export function EarlyWarningBlock({
  summary,
}: {
  summary: TeacherEarlyWarningSummary;
}) {
  const summaryText =
    summary.urgentCount > 0 && summary.watchCount > 0
      ? `ควรเข้าไปช่วยก่อน ${summary.urgentCount} คน · จับตา ${summary.watchCount} คน`
      : summary.urgentCount > 0
        ? `ควรเข้าไปช่วยก่อน ${summary.urgentCount} คน`
        : `มีนักเรียนที่ควรจับตา ${summary.watchCount} คน`;
  return (
    <section className="card p-5">
      <SectionHeader
        title="สัญญาณเตือนล่วงหน้า"
        count={summary.total || undefined}
      />
      {summary.total === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="ยังไม่พบสัญญาณที่ต้องติดตาม"
          hint="ระบบจะรวมการเข้าเรียน งานที่ยังไม่ส่ง และแนวโน้มคะแนนให้โดยอัตโนมัติ"
        />
      ) : (
        <>
          <p className="mb-2 text-xs leading-5 text-black/50">{summaryText}</p>
          <ul className="divide-y divide-black/[0.05]">
            {summary.rows.map((row) => (
              <EarlyWarningListItem key={row.enrollmentId} row={row} />
            ))}
          </ul>
          {summary.total > summary.rows.length && (
            <p className="mt-3 text-xs text-black/45">
              แสดง {summary.rows.length} จาก {summary.total} คนที่ควรติดตาม
            </p>
          )}
        </>
      )}
      <p className="mt-3 text-[11px] leading-5 text-black/40">
        เตือนเมื่อเข้าเรียนต่ำกว่า 80% หลังเช็กอย่างน้อย 3 ครั้ง · ค้างส่ง 2
        งานขึ้นไป · หรือคะแนนช่วงล่าสุดลดอย่างน้อย 10 จุด
      </p>
    </section>
  );
}

function EarlyWarningListItem({ row }: { row: EarlyWarningRow }) {
  const urgent = row.severity === "URGENT";
  return (
    <li>
      <Link
        href={`/teacher/courses/${row.courseId}/overview`}
        aria-label={`ดูข้อมูล ${row.studentName} ในวิชา ${row.courseName}`}
        className="group flex min-h-11 flex-col items-start gap-2 rounded-xl px-3 py-3 transition-colors hover:bg-black/[0.03] hover:no-underline sm:flex-row sm:items-center"
      >
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${urgent ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700"}`}
        >
          {urgent ? (
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          ) : (
            <UserRoundSearch className="h-4 w-4" aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-black">
              {row.studentName}
            </span>
            <span className={urgent ? "badge-danger" : "badge-warn"}>
              {urgent ? "ควรช่วยก่อน" : "จับตา"}
            </span>
          </span>
          <span className="mt-0.5 block text-xs text-black/50">
            {row.courseName}
            {row.learnerGroupLabel ? ` · ${row.learnerGroupLabel}` : ""}
          </span>
          <span className="mt-2 flex flex-wrap gap-1.5">
            {row.signals.map((signal) => (
              <EarlyWarningSignalBadge key={signal.kind} signal={signal} />
            ))}
          </span>
        </span>
        <span className="text-xs font-medium text-blue-700 sm:shrink-0">
          ดูวิชา
        </span>
      </Link>
    </li>
  );
}

function EarlyWarningSignalBadge({ signal }: { signal: EarlyWarningSignal }) {
  if (signal.kind === "ATTENDANCE") {
    return (
      <span className="badge-warn gap-1">
        <CalendarCheck className="h-3 w-3" aria-hidden="true" />
        เข้าเรียน {signal.rate}%
      </span>
    );
  }
  if (signal.kind === "MISSING_WORK") {
    return (
      <span className="badge-warn gap-1">
        <ClipboardX className="h-3 w-3" aria-hidden="true" />
        ค้าง {signal.count} งาน
      </span>
    );
  }
  return (
    <span className="badge-warn gap-1">
      <TrendingDown className="h-3 w-3" aria-hidden="true" />
      คะแนน {signal.previousPercent}% → {signal.recentPercent}%
    </span>
  );
}

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
              leading={
                <CourseColorChip visualKey={it.courseVisualKey} variant="dot" />
              }
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
              leading={
                <CourseColorChip visualKey={r.courseVisualKey} variant="dot" />
              }
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
                leading={
                  <CourseColorChip
                    visualKey={c.courseVisualKey}
                    variant="dot"
                  />
                }
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
