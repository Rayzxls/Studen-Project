import Link from "next/link";
import { ChevronDown, Award } from "lucide-react";
import { termGpa } from "@/lib/scoring/term-gpa";
import { deriveTermStatus } from "@/lib/scoring/term-status";
import {
  gradeForCourseOffering,
  type WeightedItem,
  type WeightedEntry,
} from "@/lib/scoring/calc";
import { formatGpa, formatPercent } from "@/lib/scoring/format";
import {
  DEFAULT_GRADE_THRESHOLDS,
  type GradeThreshold,
} from "@/lib/scoring/constants";
import type {
  StudentTermCourseRow,
  StudentTermOption,
} from "@/lib/scoring/queries";
import type { TermCourseBundle } from "@/lib/scoring/term-gpa";
import { PrintButton } from "./print-button";

/**
 * Shared transcript-style view for `/student/terms` + `/student/terms/[termId]`.
 *
 * Server component — no client JS except the Print button (which is a
 * thin <PrintButton/> that calls window.print).
 *
 * Print styles live in `globals.css @media print` (added P5-5c).
 */
type Props = {
  studentName: string;
  studentIdNumber: string;
  /** Term being displayed. May be the active term or a historical one. */
  selectedTerm: StudentTermOption;
  /** Other terms the student has enrolled in — drives the picker. */
  allTerms: StudentTermOption[];
  /** Course list metadata for the table. */
  rows: StudentTermCourseRow[];
  /** Bundles aligned 1:1 with `rows` — passed to PURE termGpa(). */
  bundles: TermCourseBundle[];
};

export function TermSummaryView({
  studentName,
  studentIdNumber,
  selectedTerm,
  allTerms,
  rows,
  bundles,
}: Props) {
  const gpaResult = termGpa(bundles);
  const status = deriveTermStatus(gpaResult);

  // Per-row grade derivation — same PURE function the GPA uses, so the
  // table column agrees with the headline number bit-for-bit.
  const perRowGrade = rows.map((r, i) => {
    const b = bundles[i]!;
    const thresholds = parseThresholds(r.gradeRulesJson);
    const res = gradeForCourseOffering(b.items, b.entries, thresholds);
    return { row: r, bundle: b, ...res };
  });

  const progressPct =
    gpaResult.totalItems === 0
      ? 0
      : Math.round((gpaResult.publishedItems / gpaResult.totalItems) * 100);

  return (
    <div className="space-y-4 print:space-y-2">
      {/* Header — student + term + actions */}
      <div className="card p-6 print:p-0 print:shadow-none print:border-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-black/50 print:text-black">
              ผลการเรียน
            </p>
            <h1
              className="mt-1 text-2xl font-bold tracking-tight text-black md:text-3xl"
              style={{ letterSpacing: "-0.02em" }}
            >
              {selectedTerm.name}
            </h1>
            <p className="mt-1 text-sm text-black/60 print:text-black">
              {studentName} · เลขประจำตัว {studentIdNumber}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <TermPicker selectedId={selectedTerm.id} allTerms={allTerms} />
            <PrintButton />
          </div>
        </div>
      </div>

      {/* GPA KPI */}
      <div className="card p-6 print:p-0 print:shadow-none print:border-none">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-black/50 print:text-black">
              GPA ภาคเรียน
            </p>
            <p
              className={
                "mt-1 text-4xl font-bold tracking-tight " +
                (gpaResult.value !== null
                  ? "text-emerald-700"
                  : "text-black/30")
              }
            >
              {formatGpa(gpaResult.value)}
            </p>
            <StatusBadge status={status} />
          </div>
          {gpaResult.value === null && gpaResult.totalItems > 0 && (
            <div className="min-w-[14rem] flex-1 print:hidden">
              <p className="text-xs text-black/50">ความคืบหน้าการเผยแพร่</p>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-emerald-500 transition-[width]"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-black/50">
                เผยแพร่แล้ว {gpaResult.publishedItems}/{gpaResult.totalItems}{" "}
                รายการ ({progressPct}%)
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Course table */}
      <div className="card p-6 print:p-0 print:shadow-none print:border-none">
        <h2
          className="mb-3 text-lg font-medium text-black print:mb-1"
          style={{ letterSpacing: "-0.02em" }}
        >
          รายวิชาในเทอม ({rows.length})
        </h2>

        {rows.length === 0 ? (
          <div className="card-flat flex items-center justify-center p-8 text-center">
            <div>
              <Award className="mx-auto mb-2 h-8 w-8 text-black/20" />
              <p className="text-sm text-black/60">ไม่มีวิชาในเทอมนี้</p>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 print:rounded-none print:border-black">
            <table className="w-full text-sm print:text-xs">
              <thead>
                <tr className="bg-slate-50/60 text-left text-xs text-black/50 print:bg-transparent print:text-black">
                  <th className="px-3 py-2">วิชา</th>
                  <th className="px-3 py-2">ครู</th>
                  <th className="px-3 py-2 text-right">หน่วยกิต</th>
                  <th className="px-3 py-2 text-right">%</th>
                  <th className="px-3 py-2 text-right">เกรด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 print:divide-black/20">
                {perRowGrade.map((rg) => (
                  <tr key={rg.row.courseOfferingId}>
                    <td className="px-3 py-2">
                      <Link
                        href={`/student/courses/${rg.row.courseOfferingId}/scores`}
                        className="font-medium text-black hover:underline print:no-underline"
                      >
                        {rg.row.name}
                      </Link>
                      {rg.row.subjectCode && (
                        <p className="text-xs text-black/40 font-mono">
                          {rg.row.subjectCode}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-black/70">
                      {rg.row.teacherFirstName} {rg.row.teacherLastName}
                    </td>
                    <td className="px-3 py-2 text-right text-black/70">
                      {rg.row.creditHours}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatPercent(rg.percent)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {rg.grade !== null ? formatGpa(rg.grade) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50/60 text-xs print:bg-transparent">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-right font-medium">
                    GPA
                  </td>
                  <td className="px-3 py-2 text-right font-bold">
                    {formatGpa(gpaResult.value)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Print-only footer — transcript identification stamp. Hidden on
          screen via Tailwind `hidden print:block`. */}
      <p className="hidden text-[10px] text-black/60 print:block">
        พิมพ์เมื่อ{" "}
        {new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
          timeZone: "Asia/Bangkok",
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(new Date())}{" "}
        น. · เอกสารอ้างอิง:{" "}
        {`${studentIdNumber}/${selectedTerm.id.slice(-6).toUpperCase()}`}
      </p>
    </div>
  );
}

function TermPicker({
  selectedId,
  allTerms,
}: {
  selectedId: string;
  allTerms: StudentTermOption[];
}) {
  if (allTerms.length <= 1) return null;
  return (
    <details className="relative">
      <summary className="btn-secondary btn-sm cursor-pointer list-none">
        เปลี่ยนเทอม
        <ChevronDown className="ml-1 inline h-3.5 w-3.5" />
      </summary>
      <ul className="absolute right-0 z-10 mt-1 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lift">
        {allTerms.map((t) => {
          const active = t.id === selectedId;
          return (
            <li key={t.id}>
              <Link
                href={`/student/terms/${t.id}`}
                className={
                  "block px-3 py-2 text-sm transition-colors hover:bg-slate-50 " +
                  (active ? "bg-slate-50 font-medium" : "")
                }
              >
                {t.name}
                {t.isActive && (
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">
                    ปัจจุบัน
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function StatusBadge({
  status,
}: {
  status: "EMPTY" | "IN_PROGRESS" | "COMPLETED";
}) {
  if (status === "COMPLETED") {
    return (
      <p className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 print:bg-transparent print:text-black">
        จบเทอมแล้ว
      </p>
    );
  }
  if (status === "IN_PROGRESS") {
    return (
      <p className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 print:bg-transparent print:text-black">
        ยังไม่จบเทอม
      </p>
    );
  }
  return (
    <p className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 print:bg-transparent print:text-black">
      ไม่มีคะแนนในเทอมนี้
    </p>
  );
}

/**
 * Defensive parser for `CourseOffering.gradeRulesJson`. Phase 5 v1 always
 * stores `null` (per Q5 lock), but the runtime resolution path is in place
 * so future overrides work without a code change. Falls back to defaults
 * on any malformed value.
 */
function parseThresholds(raw: unknown): readonly GradeThreshold[] {
  if (!Array.isArray(raw)) return DEFAULT_GRADE_THRESHOLDS;
  try {
    const parsed: GradeThreshold[] = [];
    for (const item of raw) {
      if (
        item &&
        typeof item === "object" &&
        "minPercent" in item &&
        "grade" in item &&
        typeof (item as { minPercent: unknown }).minPercent === "number" &&
        typeof (item as { grade: unknown }).grade === "number"
      ) {
        parsed.push({
          minPercent: (item as { minPercent: number }).minPercent,
          grade: (item as { grade: number }).grade,
        });
      }
    }
    if (parsed.length === 0) return DEFAULT_GRADE_THRESHOLDS;
    return parsed.sort((a, b) => b.minPercent - a.minPercent);
  } catch {
    return DEFAULT_GRADE_THRESHOLDS;
  }
}
