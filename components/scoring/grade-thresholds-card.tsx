import { Info } from "lucide-react";
import { DEFAULT_GRADE_THRESHOLDS } from "@/lib/scoring/constants";

/**
 * Read-only display of the default grade thresholds — Phase 5 v1 ships
 * default-only per Q5 grill (HANDOFF "Phase 5 entry point"). The
 * per-CourseOffering override editor is deferred; the underlying schema
 * column (`CourseOffering.gradeRulesJson`) is in place and the runtime
 * (`gradeFor(percent, thresholds)`) already accepts an override, so
 * adding the editor in a later phase is a UI-only commit.
 *
 * Server component — no client JS.
 */
export function GradeThresholdsCard() {
  return (
    <div className="card p-6">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2
            className="text-lg font-medium text-black"
            style={{ letterSpacing: "-0.02em" }}
          >
            เกณฑ์เกรด
          </h2>
          <p className="mt-0.5 text-xs text-black/50">
            ใช้แปลง % รวมของวิชาเป็นเกรด 0–4
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/60 text-left text-xs text-black/50">
              <th className="px-3 py-2">ขั้นต่ำ (%)</th>
              <th className="px-3 py-2">เกรด</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {DEFAULT_GRADE_THRESHOLDS.map((t) => (
              <tr key={`${t.minPercent}-${t.grade}`}>
                <td className="px-3 py-2 font-mono">
                  {t.minPercent === 0 ? "< 50" : `≥ ${t.minPercent}`}
                </td>
                <td className="px-3 py-2 font-medium text-black">
                  {t.grade.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 flex items-start gap-1.5 text-xs text-black/50">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          ระบบใช้เกณฑ์มาตรฐานเดียวกับทุกวิชา —
          การปรับเกณฑ์เฉพาะวิชาจะเปิดให้ใช้ในเวอร์ชันถัดไป
        </span>
      </p>
    </div>
  );
}
