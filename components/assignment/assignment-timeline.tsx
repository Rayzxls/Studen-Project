import Link from "next/link";

/**
 * Due-date timeline for the student Assignments page — Phase 12 "งาน
 * cockpit". Plots each dated assignment as a dot along a horizontal track
 * scaled to the span of due dates, with a "วันนี้" marker. Purely
 * presentational (server component): the parent computes positions-free
 * inputs and this maps them to a linear scale.
 *
 * Dots are links to the assignment; the label lives in the native tooltip
 * so many dots never collide. The nearest pending item (`isNext`) gets a
 * ring so it reads as the same thing the countdown hero is counting to.
 */

export type TimelineItem = {
  id: string;
  title: string;
  href: string;
  dueMs: number;
  tone: "overdue" | "soon" | "future" | "done";
  isNext: boolean;
  dueLabel: string;
};

const DOT_TONE: Record<TimelineItem["tone"], string> = {
  overdue: "bg-red-500",
  soon: "bg-orange-500",
  future: "bg-blue-500",
  done: "bg-green-500",
};

const EDGE_FMT = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  timeZone: "Asia/Bangkok",
  day: "numeric",
  month: "short",
});

export function AssignmentTimeline({
  items,
  nowMs,
}: {
  items: TimelineItem[];
  nowMs: number;
}) {
  if (items.length < 2) return null;

  const dues = items.map((i) => i.dueMs);
  const rawStart = Math.min(nowMs, ...dues);
  const rawEnd = Math.max(nowMs, ...dues);
  // Pad the domain by 6% each side so edge dots aren't flush against the ends.
  const span = Math.max(rawEnd - rawStart, 1);
  const start = rawStart - span * 0.06;
  const end = rawEnd + span * 0.06;
  const pos = (ms: number) => ((ms - start) / (end - start)) * 100;

  return (
    <section className="card p-5 md:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2
          className="text-base font-medium text-black"
          style={{ letterSpacing: "-0.01em" }}
        >
          เส้นเวลาส่งงาน
        </h2>
        <span className="text-xs text-black/50">{items.length} งานมีกำหนด</span>
      </div>

      <div className="relative mx-1 mt-10 mb-8 h-1 rounded-full bg-black/[0.08]">
        {/* วันนี้ marker */}
        <div
          className="absolute -top-1.5 z-10 w-0.5 rounded-full bg-black"
          style={{ height: 16, left: `${pos(nowMs)}%` }}
        >
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-black">
            วันนี้
          </span>
        </div>

        {items.map((item) => {
          const left = pos(item.dueMs);
          return (
            <Link
              key={item.id}
              href={item.href}
              title={`${item.title} · ${item.dueLabel}`}
              className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${left}%` }}
            >
              <span
                className={
                  "block rounded-full ring-2 ring-surface transition-transform group-hover:scale-125 " +
                  DOT_TONE[item.tone] +
                  (item.isNext ? " h-3.5 w-3.5 ring-blue-500/40" : " h-3 w-3")
                }
              />
            </Link>
          );
        })}

        <span className="absolute -bottom-6 left-0 text-[10px] text-black/40">
          {EDGE_FMT.format(new Date(rawStart))}
        </span>
        <span className="absolute -bottom-6 right-0 text-[10px] text-black/40">
          {EDGE_FMT.format(new Date(rawEnd))}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-black/55">
        <LegendDot className="bg-red-500" label="เลยกำหนด" />
        <LegendDot className="bg-orange-500" label="ใกล้ครบ" />
        <LegendDot className="bg-blue-500" label="ยังมีเวลา" />
        <LegendDot className="bg-green-500" label="ส่งแล้ว" />
      </div>
    </section>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={"h-2 w-2 rounded-full " + className} />
      {label}
    </span>
  );
}
