import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Ban, ChevronLeft } from "lucide-react";
import { assert } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { getAttendanceGridForTeacher } from "@/lib/attendance/queries";
import { listTimetableSlots } from "@/lib/attendance/timetable";
import { dayOfWeekLabel, formatSessionHeader } from "@/lib/attendance/format";
import { CourseShell } from "@/components/course/course-shell";
import {
  AttendanceGrid,
  type GridStudentRow,
} from "@/components/attendance/grid";
import { CancelSessionDialog } from "@/components/attendance/cancel-session-dialog";
import { teacherCourseTabs } from "../../_tabs";

// Auth-gated DB-fetching page — skip static prerender.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string; sessionId: string }>;
}

export default async function AttendanceGridPage({ params }: PageProps) {
  const { id, sessionId } = await params;

  // Authz first — also returns the session row so we can skip a duplicate
  // read. NotFound vs Forbidden split mirrors ownsCourse posture.
  let guard;
  try {
    guard = await assert.canMutateSession(sessionId);
  } catch {
    redirect(`/teacher/courses/${id}/attendance`);
  }

  // Sanity: session belongs to *this* course (URL tampering). The guard
  // already checked teacher ownership of the session's course; here we
  // additionally bail if the URL `id` mismatches.
  if (guard.sessionRow.courseOfferingId !== id) {
    redirect(
      `/teacher/courses/${guard.sessionRow.courseOfferingId}/attendance/${sessionId}`
    );
  }

  const [course, grid, slots] = await Promise.all([
    getCourseOfferingForTeacher(id, guard.session.user.id),
    getAttendanceGridForTeacher(sessionId),
    listTimetableSlots(id),
  ]);
  if (!course || !grid) notFound();

  const rows: GridStudentRow[] = grid.rows.map((r) => ({
    enrollmentId: r.enrollmentId,
    removed: r.removed,
    studentName: `${r.student.firstName} ${r.student.lastName}`,
    studentIdNumber: r.student.studentId,
    initialStatus: r.record?.status ?? null,
    initialNote: r.record?.note ?? null,
    editCount: r.record?.editCount ?? 0,
  }));

  const slot = grid.session.note;
  // Resolve TimetableSlot provenance for header badge (best-effort: slot
  // may have been deleted since materialization, in which case we silently
  // omit the badge — Session row's own scheduledStart/End is authoritative).
  const slotProvenance = await resolveSlotProvenance(
    grid.session.scheduledStart,
    grid.session.scheduledEnd,
    slots
  );
  void slot; // note rendered separately below

  const cancelled = grid.session.cancelledAt !== null;

  return (
    <CourseShell
      course={course}
      eyebrow="รายวิชาที่สอน"
      backHref="/teacher/courses"
      tabs={teacherCourseTabs(id)}
    >
      <div className="space-y-4">
        <Link
          href={`/teacher/courses/${id}/attendance`}
          className="inline-flex items-center gap-1 text-xs text-black/60 hover:text-black"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          กลับไปรายการคาบ
        </Link>

        <div className="card p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2
                className="text-lg font-medium text-black"
                style={{ letterSpacing: "-0.02em" }}
              >
                {formatSessionHeader(
                  grid.session.scheduledStart,
                  grid.session.scheduledEnd
                )}
                {cancelled && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">
                    <Ban className="h-3 w-3" />
                    ยกเลิก
                  </span>
                )}
              </h2>
              {slotProvenance && (
                <p className="mt-1 text-xs text-black/50">
                  ตามตาราง: วัน{dayOfWeekLabel(slotProvenance.dayOfWeek)}{" "}
                  {slotProvenance.startTime}–{slotProvenance.endTime} น.
                  {slotProvenance.location && ` · ${slotProvenance.location}`}
                </p>
              )}
              {!slotProvenance && !cancelled && (
                <p className="mt-1 text-xs text-black/40">เปิดแบบ ad-hoc</p>
              )}
              {grid.session.note && (
                <p className="mt-1 text-xs text-black/70">
                  บันทึก: {grid.session.note}
                </p>
              )}
              {cancelled && grid.session.cancelledReason && (
                <p className="mt-1 text-xs text-rose-700/70">
                  เหตุผลที่ยกเลิก: {grid.session.cancelledReason}
                </p>
              )}
            </div>
            {!cancelled && (
              <CancelSessionDialog courseId={id} sessionId={sessionId} />
            )}
          </div>

          <AttendanceGrid
            courseId={id}
            sessionId={sessionId}
            scheduledStartIso={grid.session.scheduledStart.toISOString()}
            rows={rows}
            cancelled={cancelled}
          />
        </div>
      </div>
    </CourseShell>
  );
}

/**
 * Try to find a TimetableSlot that matches this Session's scheduledStart
 * (DOW + startTime in Bangkok). Used only for the provenance badge — falsy
 * result is fine (the Session row stands on its own).
 */
async function resolveSlotProvenance(
  scheduledStart: Date,
  scheduledEnd: Date,
  slots: Awaited<ReturnType<typeof listTimetableSlots>>
): Promise<{
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location: string | null;
} | null> {
  // Compute DOW + HH:mm in Asia/Bangkok via Intl (no manual TZ arithmetic).
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const partsStart = fmt.formatToParts(scheduledStart);
  const partsEnd = fmt.formatToParts(scheduledEnd);
  const dowShort = partsStart.find((p) => p.type === "weekday")?.value ?? "";
  const dowMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dow = dowMap[dowShort];
  if (dow === undefined) return null;
  const hhStart = partsStart.find((p) => p.type === "hour")?.value ?? "";
  const mmStart = partsStart.find((p) => p.type === "minute")?.value ?? "";
  const hhEnd = partsEnd.find((p) => p.type === "hour")?.value ?? "";
  const mmEnd = partsEnd.find((p) => p.type === "minute")?.value ?? "";
  const startTime = `${hhStart}:${mmStart}`;
  const endTime = `${hhEnd}:${mmEnd}`;
  const match = slots.find(
    (s) =>
      s.dayOfWeek === dow && s.startTime === startTime && s.endTime === endTime
  );
  return match
    ? {
        dayOfWeek: match.dayOfWeek,
        startTime: match.startTime,
        endTime: match.endTime,
        location: match.location,
      }
    : null;
}
