import Link from "next/link";
import { ChevronDown, Award } from "lucide-react";
import { gradeForCourseOffering, scoreTotal } from "@/lib/scoring/calc";
import { formatPercent } from "@/lib/scoring/format";
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
 * "ผลการเรียนของฉัน" — shared view for `/student/terms` +
 * `/student/terms/[termId]` (CONTEXT § Learning Results).
 *
 * Mental model: per-course grades. The course table is the hero — each row
 * shows คะแนนรวม / % / เกรดรายวิชา / สถานะ. Term is a lightweight filter
 * (picker top-right), NOT a GPA container: no Term-GPA hero card, no
 * "ยังไม่จบเทอม" progress. A course's grade renders only when every
 * ScoreItem of that course is published; partial publishes show the
 * running score with a "กำลังอัปเดต" badge instead of a fake final grade.
 *
 * Server component — no client JS except the Print button.
 * Print styles live in `globals.css @media print`.
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
  /** Bundles aligned 1:1 with `rows` — published items + own entries. */
  bundles: TermCourseBundle[];
};

type CourseRowStatus = "NO_SCORES" | "UPDATING" | "FINAL";

export function TermSummaryView({
  studentName,
  studentIdNumber,
  selectedTerm,
  allTerms,
  rows,
  bundles,
}: Props) {
  // Per-row derivation. The grade comes from the same PURE function the
  // rest of the system uses (null until publish is complete); the running
  // score/percent are computed over PUBLISHED items only so a partially
  // published course never fakes a final number.
  const courseRows = rows.map((r, i) => {
    const b = bundles[i]!;
    const thresholds = parseThresholds(r.gradeRulesJson);
    const res = gradeForCourseOffering(b.items, b.entries, thresholds);

    const entryByItem = new Map(b.entries.map((e) => [e.scoreItemId, e.value]));
    let scoreSum = 0;
    let fullSum = 0;
    for (const it of b.items) {
      if (it.publishedAt === null || it.fullScore <= 0) continue;
      scoreSum += entryByItem.get(it.id) ?? 0;
      fullSum += it.fullScore;
    }
    const partialPercent = scoreTotal(b.items, b.entries);

    const status: CourseRowStatus =
      res.publishedItems === 0
        ? "NO_SCORES"
        : res.publishedItems < res.totalItems
          ? "UPDATING"
          : "FINAL";

    return {
      row: r,
      grade: res.grade,
      scoreSum,
      fullSum,
      percent: partialPercent,
      status,
    };
  });

  return (
    <div className="space-y-4 print:space-y-2">
      {/* Header — student + light term filter */}
      <div className="card p-6 print:p-0 print:shadow-none print:border-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-black/50 print:text-black">
              {selectedTerm.name}
              {selectedTerm.isActive && " · ภาคเรียนปัจจุบัน"}
            </p>
            <h1
              className="mt-1 text-2xl font-bold tracking-tight text-black md:text-3xl"
              style={{ letterSpacing: "-0.02em" }}
            >
              ผลการเรียนของฉัน
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

      {/* Course table — the hero of this page */}
      <div className="card p-6 print:p-0 print:shadow-none print:border-none">
        <h2
          className="mb-3 text-lg font-medium text-black print:mb-1"
          style={{ letterSpacing: "-0.02em" }}
        >
          รายวิชา ({rows.length})
        </h2>

        {rows.length === 0 ? (
          <div className="card-flat flex items-center justify-center p-8 text-center">
            <div>
              <Award className="mx-auto mb-2 h-8 w-8 text-black/20" />
              <p className="text-sm text-black/60">ไม่มีวิชาในเทอมนี้</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 print:rounded-none print:border-black">
            <table className="w-full text-sm print:text-xs">
              <thead>
                <tr className="bg-slate-50/60 text-left text-xs text-black/50 print:bg-transparent print:text-black">
                  <th className="px-3 py-2">วิชา</th>
                  <th className="px-3 py-2">ครู</th>
                  <th className="px-3 py-2 text-right">คะแนนรวม</th>
                  <th className="px-3 py-2 text-right">%</th>
                  <th className="px-3 py-2 text-right">เกรด</th>
                  <th className="px-3 py-2 text-right">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 print:divide-black/20">
                {courseRows.map((cr) => (
                  <tr key={cr.row.courseOfferingId}>
                    <td className="px-3 py-2">
                      <Link
                        href={`/student/courses/${cr.row.courseOfferingId}/scores`}
                        className="font-medium text-black hover:underline print:no-underline"
                      >
                        {cr.row.name}
                      </Link>
                      {cr.row.subjectCode && (
                        <p className="text-xs text-black/40 font-mono">
                          {cr.row.subjectCode}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-black/70">
                      {cr.row.teacherFirstName} {cr.row.teacherLastName}
                    </td>
                    <td className="px-3 py-2 text-right text-black/70">
                      {cr.status === "NO_SCORES" ? (
                        <span className="text-black/30">—</span>
                      ) : (
                        <>
                          {cr.scoreSum}
                          <span className="text-black/40">/{cr.fullSum}</span>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {cr.status === "NO_SCORES"
                        ? "—"
                        : formatPercent(cr.percent)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {cr.grade !== null ? (
                        <span className="text-blue-700 print:text-black">
                          {cr.grade.toFixed(1)}
                        </span>
                      ) : (
                        <span className="font-normal text-black/30">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <CourseStatusBadge status={cr.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-xs text-black/40 print:hidden">
          เกรดของแต่ละวิชาจะแสดงเมื่อครูประกาศคะแนนครบทุกรายการของวิชานั้น
        </p>
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

function CourseStatusBadge({ status }: { status: CourseRowStatus }) {
  if (status === "FINAL") {
    return (
      <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 print:bg-transparent print:text-black">
        ประกาศแล้ว
      </span>
    );
  }
  if (status === "UPDATING") {
    return (
      <span className="inline-flex rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700 print:bg-transparent print:text-black">
        กำลังอัปเดต
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 print:bg-transparent print:text-black">
      ยังไม่มีคะแนน
    </span>
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
                  <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">
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
