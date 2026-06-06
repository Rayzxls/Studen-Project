import {
  getStudentTodaySchedule,
  type TodayClass,
} from "@/lib/dashboard/queries";
import { CourseColorChip } from "@/components/course/course-color-chip";

/**
 * StudentTodayPanel — Phase 11D · ADR-0028 § 8 (student maximum vibrancy).
 *
 * Shows today's class list above the DueSoonWidget on the student
 * dashboard. Renders nothing when there are no slots today — an empty
 * "วันนี้" panel below a saturated blue hero would feel hollow.
 *
 * Each row carries a CourseColorChip marker so colour identity stays
 * consistent with the course-grid chips below and with the course feed
 * surfaces nested under `/student/courses/[id]`.
 */
export async function StudentTodayPanel({
  studentUserId,
}: {
  studentUserId: string;
}) {
  const today = await getStudentTodaySchedule(studentUserId);
  if (today.length === 0) return null;

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2
          className="text-sm font-medium text-black"
          style={{ letterSpacing: "-0.01em" }}
        >
          วันนี้ ({today.length} คาบ)
        </h2>
        <p className="text-[11px] text-black/40">เริ่ม {today[0]!.startTime}</p>
      </div>
      <ul className="space-y-1.5">
        {today.map((s) => (
          <Row key={`${s.courseId}-${s.startTime}`} slot={s} />
        ))}
      </ul>
    </section>
  );
}

function Row({ slot }: { slot: TodayClass }) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-black/[0.02] px-3 py-2.5 transition-colors hover:bg-black/[0.04]">
      <CourseColorChip classId={slot.classId} variant="marker" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-black">
          {slot.courseName}
        </p>
        <p className="mt-0.5 truncate text-xs text-black/55">
          ห้อง {slot.className}
          {slot.location ? ` · ${slot.location}` : ""}
        </p>
      </div>
      <span className="shrink-0 font-mono text-xs text-black/70">
        {slot.startTime}–{slot.endTime}
      </span>
    </li>
  );
}
