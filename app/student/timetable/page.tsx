import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, MapPin } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { TopNav } from "@/components/layout/top-nav";
import { StudentBottomNav } from "@/components/layout/student-bottom-nav";
import { getCourseSlotColors } from "@/lib/theme/course-color";

/**
 * /student/timetable — "ตารางเรียนของฉัน".
 *
 * Every enrolled CourseOffering already carries its TimetableSlots, but no
 * student surface ever assembled them — students were photographing paper
 * timetables. This page merges the slots of all ACTIVE enrollments into a
 * Mon-Sun week view (weekend days render only when a slot exists), sorted
 * by start time, with the course-slot colour chip used across the app.
 *
 * Read-only own-data projection (L1): active enrollments of the caller
 * only — no peer data of any kind.
 */

export const dynamic = "force-dynamic";

const DAY_LABELS = [
  "อาทิตย์",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "ศุกร์",
  "เสาร์",
] as const;

/** Render order: Monday first, weekend last (Thai school week). */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

interface SlotRow {
  id: string;
  startTime: string;
  endTime: string;
  location: string | null;
  courseName: string;
  subjectCode: string | null;
  classId: string;
}

export default async function StudentTimetablePage() {
  let session;
  try {
    session = await requireRole(["STUDENT"]);
  } catch {
    redirect("/dashboard");
  }

  const enrollments = await db.enrollment.findMany({
    where: {
      studentId: session.user.id,
      removedAt: null,
      course: { archivedAt: null },
    },
    select: {
      course: {
        select: {
          id: true,
          name: true,
          subjectCode: true,
          classId: true,
          timetableSlots: {
            select: {
              id: true,
              dayOfWeek: true,
              startTime: true,
              endTime: true,
              location: true,
            },
          },
        },
      },
    },
  });

  const byDay = new Map<number, SlotRow[]>();
  for (const { course } of enrollments) {
    for (const slot of course.timetableSlots) {
      const rows = byDay.get(slot.dayOfWeek) ?? [];
      rows.push({
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        location: slot.location,
        courseName: course.name,
        subjectCode: course.subjectCode,
        classId: course.classId,
      });
      byDay.set(slot.dayOfWeek, rows);
    }
  }
  for (const rows of byDay.values()) {
    rows.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  // Weekdays always render (an empty school day is information too);
  // weekend days appear only when something is scheduled.
  const visibleDays = DAY_ORDER.filter(
    (d) => (d >= 1 && d <= 5) || (byDay.get(d)?.length ?? 0) > 0
  );

  // "Today" in Bangkok time — highlights the current day card.
  const todayDow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
  ).getDay();

  const totalSlots = enrollments.reduce(
    (n, e) => n + e.course.timetableSlots.length,
    0
  );

  return (
    <div className="min-h-screen bg-bg">
      <TopNav session={session} />

      <main className="mx-auto max-w-3xl animate-fade-in px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-600">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1
              className="text-2xl font-semibold text-black"
              style={{ letterSpacing: "-0.02em" }}
            >
              ตารางเรียนของฉัน
            </h1>
            <p className="mt-0.5 text-sm text-black/55">
              รวมทุกวิชาที่เรียนอยู่ · เรียงตามเวลาเริ่มคาบ
            </p>
          </div>
        </div>

        {totalSlots === 0 ? (
          <div className="card mt-6 grid min-h-48 place-items-center p-8 text-center">
            <div>
              <p className="text-sm font-medium text-black/70">
                ยังไม่มีตารางเรียน
              </p>
              <p className="mt-1 text-xs text-black/45">
                เมื่อครูตั้งตารางสอนของวิชาที่คุณเรียน คาบเรียนจะแสดงที่นี่
              </p>
              <Link href="/dashboard" className="btn-ghost btn-sm mt-4">
                กลับหน้าหลัก
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {visibleDays.map((day) => {
              const rows = byDay.get(day) ?? [];
              const isToday = day === todayDow;
              return (
                <section
                  key={day}
                  className={`card p-4 sm:p-5 ${isToday ? "ring-2 ring-blue-500/40" : ""}`}
                  aria-label={`วัน${DAY_LABELS[day]}`}
                >
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-black">
                      วัน{DAY_LABELS[day]}
                    </h2>
                    {isToday && <span className="badge-info">วันนี้</span>}
                    <span className="ml-auto text-xs text-black/40">
                      {rows.length > 0 ? `${rows.length} คาบ` : ""}
                    </span>
                  </div>

                  {rows.length === 0 ? (
                    <p className="mt-3 text-xs text-black/40">ไม่มีคาบเรียน</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {rows.map((slot) => {
                        const colors = getCourseSlotColors(slot.classId);
                        return (
                          <li
                            key={slot.id}
                            className="flex items-center gap-3 rounded-xl p-3"
                            style={{ background: colors.bgTinted }}
                          >
                            <span
                              aria-hidden="true"
                              className="h-9 w-1.5 shrink-0 rounded-full"
                              style={{ background: colors.bg }}
                            />
                            <div className="min-w-0 flex-1">
                              <p
                                className="truncate text-sm font-semibold"
                                style={{ color: colors.text }}
                              >
                                {slot.courseName}
                                {slot.subjectCode && (
                                  <span className="ml-1.5 font-normal opacity-70">
                                    ({slot.subjectCode})
                                  </span>
                                )}
                              </p>
                              <p
                                className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs"
                                style={{ color: colors.text }}
                              >
                                <span className="font-mono">
                                  {slot.startTime} – {slot.endTime}
                                </span>
                                {slot.location && (
                                  <span className="inline-flex items-center gap-1 opacity-80">
                                    <MapPin
                                      className="h-3 w-3"
                                      aria-hidden="true"
                                    />
                                    {slot.location}
                                  </span>
                                )}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}

        <div className="h-20 md:hidden" />
      </main>

      <StudentBottomNav role="student" />
    </div>
  );
}
