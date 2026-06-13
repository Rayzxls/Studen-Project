import { notFound } from "next/navigation";
import { CalendarClock, KeyRound, SlidersHorizontal } from "lucide-react";
import { db } from "@/lib/db/client";
import { listTimetableSlots } from "@/lib/attendance/timetable";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminCourseSettingsPage({ params }: PageProps) {
  const { id } = await params;
  const [course, slots] = await Promise.all([
    db.courseOffering.findUnique({
      where: { id },
      select: {
        classCode: true,
        codeActive: true,
        codeExpiresAt: true,
        gradeRulesJson: true,
      },
    }),
    listTimetableSlots(id),
  ]);

  if (!course) notFound();

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-black">
          <KeyRound className="h-4 w-4 text-blue-600" />
          รหัสเข้าห้อง
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <InfoBox label="รหัส" value={course.classCode} mono />
          <InfoBox
            label="สถานะ"
            value={course.codeActive ? "เปิดรับนักเรียน" : "ปิดรับนักเรียน"}
          />
          <InfoBox
            label="หมดอายุ"
            value={
              course.codeExpiresAt
                ? formatDate(course.codeExpiresAt)
                : "ไม่กำหนด"
            }
          />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-black">
          <CalendarClock className="h-4 w-4 text-blue-600" />
          ตารางสอน
        </h2>
        {slots.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-ink-soft">
            ยังไม่มีตารางสอน
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-black/[0.06]">
            {slots.map((slot) => (
              <li
                key={slot.id}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <span className="font-medium text-black">
                  {dayLabel(slot.dayOfWeek)}
                </span>
                <span className="text-ink-soft">
                  {slot.startTime}–{slot.endTime}
                  {slot.location ? ` · ${slot.location}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-black">
          <SlidersHorizontal className="h-4 w-4 text-blue-600" />
          เกณฑ์เกรด
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          {course.gradeRulesJson
            ? "รายวิชานี้มีเกณฑ์เกรดเฉพาะรายวิชา"
            : "ใช้เกณฑ์เกรดมาตรฐานของระบบ"}
        </p>
      </section>
    </div>
  );
}

function InfoBox({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-black/[0.035] p-4">
      <p className="text-xs text-ink-soft">{label}</p>
      <p
        className={
          "mt-1 text-sm font-semibold text-black " + (mono ? "font-mono" : "")
        }
      >
        {value}
      </p>
    </div>
  );
}

function dayLabel(day: number): string {
  return (
    ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"][day] ??
    `วันที่ ${day}`
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
