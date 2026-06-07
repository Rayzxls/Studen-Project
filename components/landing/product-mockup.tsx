import { GraduationCap } from "lucide-react";
import { CourseColorChip } from "@/components/course/course-color-chip";

/**
 * ProductMockup — a clean browser-window mock of the Beagle Classroom
 * dashboard, used to fill the centre of the Section 2 illustration so the
 * surrounding feature cards read as "things that orbit the real product".
 * Pure markup (no data), styled in the app's own visual language.
 */
export function ProductMockup({ className }: { className?: string }) {
  return (
    <div
      className={
        "overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-card " +
        (className ?? "")
      }
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-black/[0.05] bg-black/[0.015] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        <span className="ml-3 hidden flex-1 truncate rounded-md bg-black/[0.04] px-3 py-1 text-[10px] text-black/45 sm:block">
          beagle-classroom.app/dashboard
        </span>
      </div>

      {/* Body */}
      <div className="p-4">
        {/* Greeting hero strip */}
        <div className="relative overflow-hidden rounded-xl bg-blue-500 p-4">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(60% 80% at 85% 0%, rgba(255,255,255,0.22) 0%, transparent 60%)",
            }}
          />
          <div className="relative flex items-center gap-2 text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20">
              <GraduationCap className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] text-white/80">สวัสดีตอนเช้า</p>
              <p
                className="text-sm font-semibold"
                style={{ letterSpacing: "-0.02em" }}
              >
                รายวินทร์ · ม.4/2
              </p>
            </div>
          </div>
        </div>

        {/* KPI tiles */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Kpi tone="green" label="มาเรียน" value="88%" />
          <Kpi tone="blue" label="คะแนนรวม" value="92%" />
          <Kpi tone="orange" label="งานค้าง" value="2" />
        </div>

        {/* Course rows */}
        <div className="mt-3 space-y-2">
          <CourseRow
            classId="science-4a"
            name="คณิตศาสตร์ ม.4/2"
            code="MATH4A"
          />
          <CourseRow classId="phys-4a" name="ฟิสิกส์ 2" code="PHYS2" />
        </div>
      </div>
    </div>
  );
}

function Kpi({
  tone,
  label,
  value,
}: {
  tone: "green" | "blue" | "orange";
  label: string;
  value: string;
}) {
  const cls = {
    green: "bg-green-50 text-green-700",
    blue: "bg-blue-50 text-blue-700",
    orange: "bg-orange-50 text-orange-700",
  }[tone];
  return (
    <div className={"rounded-lg p-2.5 " + cls}>
      <p className="text-[9px] opacity-80">{label}</p>
      <p
        className="mt-0.5 text-lg font-semibold"
        style={{ letterSpacing: "-0.02em" }}
      >
        {value}
      </p>
    </div>
  );
}

function CourseRow({
  classId,
  name,
  code,
}: {
  classId: string;
  name: string;
  code: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-black/[0.05] bg-white px-3 py-2.5">
      <CourseColorChip classId={classId} variant="marker" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-black">{name}</p>
        <p className="font-mono text-[9px] text-black/40">{code}</p>
      </div>
      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-medium text-blue-700">
        เปิดเรียน
      </span>
    </div>
  );
}
