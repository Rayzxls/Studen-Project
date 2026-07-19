/**
 * Workload heatmap for the student Assignments page — Phase 12 "งาน cockpit"
 * · phase 2. A 4-week calendar (Mon-first, Bangkok) shaded by how many
 * pending assignments fall due each day, so a student sees where the crunch
 * weeks are. Purely presentational server component.
 *
 * Calendar dates are treated as opaque `YYYY-MM-DD` strings: due instants map
 * to their Bangkok day, and the grid iterates from the Monday of the current
 * Bangkok week using a UTC-midnight anchor (Bangkok has no DST, so the string
 * math stays exact).
 */

const BKK_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const BKK_WD = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Bangkok",
  weekday: "short",
});
const THAI_DATE = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  timeZone: "Asia/Bangkok",
  weekday: "short",
  day: "numeric",
  month: "short",
});

const WD_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};
const DAY_LABELS = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
const WEEKS = 4;

const pad = (n: number) => String(n).padStart(2, "0");

function cellClass(count: number, isPast: boolean): string {
  if (count === 0) return "bg-black/[0.035]";
  const base =
    count >= 3
      ? "bg-blue-500/80"
      : count === 2
        ? "bg-blue-500/50"
        : "bg-blue-500/25";
  return isPast ? `${base} opacity-50` : base;
}

export function WorkloadHeatmap({
  dueDates,
  nowMs,
}: {
  /** Due instants (ms) of PENDING assignments only. */
  dueDates: number[];
  nowMs: number;
}) {
  if (dueDates.length === 0) return null;

  const today = BKK_DAY.format(nowMs);
  const dowMon = WD_INDEX[BKK_WD.format(nowMs)] ?? 0;

  const counts: Record<string, number> = {};
  for (const ms of dueDates) {
    const k = BKK_DAY.format(ms);
    counts[k] = (counts[k] ?? 0) + 1;
  }

  const anchor = new Date(`${today}T00:00:00Z`);
  anchor.setUTCDate(anchor.getUTCDate() - dowMon);

  const days = Array.from({ length: WEEKS * 7 }, (_, i) => {
    const d = new Date(anchor);
    d.setUTCDate(anchor.getUTCDate() + i);
    const key = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    return {
      key,
      count: counts[key] ?? 0,
      isToday: key === today,
      isPast: key < today,
      dayNum: d.getUTCDate(),
      ms: d.getTime(),
    };
  });

  const peak = days.reduce((m, d) => (d.count > m.count ? d : m), days[0]!);

  return (
    <section className="card p-5 md:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2
          className="text-base font-medium text-black"
          style={{ letterSpacing: "-0.01em" }}
        >
          ภาระงานล่วงหน้า
        </h2>
        <span className="text-xs text-black/50">4 สัปดาห์</span>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {DAY_LABELS.map((d, i) => (
          <div
            key={`h-${i}`}
            className="pb-0.5 text-center text-[10px] font-medium text-black/40"
          >
            {d}
          </div>
        ))}
        {days.map((d) => (
          <div
            key={d.key}
            title={
              d.count > 0
                ? `${THAI_DATE.format(d.ms)} · ${d.count} งานครบกำหนด`
                : THAI_DATE.format(d.ms)
            }
            className={
              "flex min-h-12 items-center justify-center rounded-lg text-[11px] font-medium md:min-h-16 " +
              cellClass(d.count, d.isPast) +
              (d.count >= 2 ? " text-white" : " text-black/60") +
              (d.isToday
                ? " ring-2 ring-blue-500 ring-offset-1 ring-offset-surface"
                : "")
            }
          >
            {d.dayNum}
          </div>
        ))}
      </div>

      {peak.count >= 2 && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-black/60">
          <span
            className="h-2 w-2 rounded-full bg-blue-500"
            aria-hidden="true"
          />
          หนักสุด {THAI_DATE.format(peak.ms)} — {peak.count} งานครบกำหนดวันเดียว
        </p>
      )}
    </section>
  );
}
