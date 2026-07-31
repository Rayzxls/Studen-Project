import Link from "next/link";
import { ArrowRight, CalendarClock } from "lucide-react";

/**
 * Shown on a course that has no timetable slot yet. Attendance sessions hang
 * off a slot, so until one exists the course cannot take a roll call and does
 * not appear on the teacher's or students' timetable — but nothing else about a
 * freshly created course looks unfinished, so the gap is easy to miss.
 *
 * It disappears on its own once a slot exists, so it needs no dismiss control
 * and no stored state.
 */
export function TimetableSetupHint({ courseId }: { courseId: string }) {
  return (
    <section className="card flex flex-col gap-4 border-blue-500/20 bg-blue-50/60 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface text-blue-700 shadow-sm">
          <CalendarClock className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-semibold text-ink">ตั้งเวลาเรียนของวิชานี้</h2>
          <p className="mt-1 max-w-xl text-sm text-ink-soft">
            ยังไม่มีคาบเรียน —
            เพิ่มวันและเวลาเพื่อให้วิชานี้ขึ้นบนตารางสอนของคุณ
            ตารางเรียนของนักเรียน และเปิดให้เช็กชื่อตามคาบได้
          </p>
        </div>
      </div>
      <Link
        href={`/teacher/courses/${courseId}/settings#timetable`}
        className="btn-primary btn-sm shrink-0 justify-center"
      >
        ตั้งเวลาเรียน
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
