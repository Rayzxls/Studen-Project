import Link from "next/link";
import { Archive, Award, BookOpen, GraduationCap } from "lucide-react";
import { gradeForCourseOffering, scoreTotal } from "@/lib/scoring/calc";
import {
  DEFAULT_GRADE_THRESHOLDS,
  type GradeThreshold,
} from "@/lib/scoring/constants";
import { formatPercent } from "@/lib/scoring/format";
import type { StudentLearningResultRow } from "@/lib/scoring/queries";
import { PrintButton } from "./print-button";

type Props = {
  studentName: string;
  rows: StudentLearningResultRow[];
  view: "active" | "archive";
};

type CourseRowStatus = "NO_SCORES" | "UPDATING" | "FINAL";

export function LearningResultsView({ studentName, rows, view }: Props) {
  const visibleRows = rows.filter((row) => {
    const active = row.archivedAt === null && row.enrollmentRemovedAt === null;
    return view === "active" ? active : !active;
  });

  const courseRows = visibleRows.map((row) => {
    const result = gradeForCourseOffering(
      row.items,
      row.entries,
      parseThresholds(row.gradeRulesJson)
    );
    const entries = new Map(
      row.entries.map((entry) => [entry.scoreItemId, entry.value])
    );
    let scoreSum = 0;
    let fullSum = 0;
    for (const item of row.items) {
      if (item.publishedAt === null || item.fullScore <= 0) continue;
      scoreSum += entries.get(item.id) ?? 0;
      fullSum += item.fullScore;
    }

    const status: CourseRowStatus =
      result.publishedItems === 0
        ? "NO_SCORES"
        : result.publishedItems < result.totalItems
          ? "UPDATING"
          : "FINAL";

    return {
      row,
      grade: result.grade,
      scoreSum,
      fullSum,
      percent: scoreTotal(row.items, row.entries),
      status,
    };
  });

  const activeCount = rows.filter(
    (row) => row.archivedAt === null && row.enrollmentRemovedAt === null
  ).length;
  const archiveCount = rows.length - activeCount;

  return (
    <div className="space-y-4 print:space-y-2">
      <section className="card p-6 print:border-none print:p-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-medium text-ink-soft">
                สรุปคะแนนแยกตามรายวิชา
              </p>
              <h1 className="mt-1 text-2xl font-bold md:text-3xl">
                ผลการเรียนของฉัน
              </h1>
              <p className="mt-1 text-sm text-ink-soft">{studentName}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <nav
              aria-label="มุมมองผลการเรียน"
              className="inline-flex rounded-lg bg-bg p-1"
            >
              <ResultTab
                href="/student/terms"
                active={view === "active"}
                label={`กำลังเรียน ${activeCount}`}
              />
              <ResultTab
                href="/student/terms?view=archive"
                active={view === "archive"}
                label={`ประวัติ ${archiveCount}`}
              />
            </nav>
            <PrintButton />
          </div>
        </div>
      </section>

      <section className="card p-6 print:border-none print:p-0 print:shadow-none">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {view === "active" ? "รายวิชาที่กำลังเรียน" : "ประวัติรายวิชา"}
            </h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              คะแนนและเกรดของแต่ละวิชาแสดงแยกจากกัน ไม่มีการรวมผลข้ามวิชา
            </p>
          </div>
          <span className="badge">{courseRows.length} วิชา</span>
        </div>

        {courseRows.length === 0 ? (
          <EmptyResults view={view} />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--color-hairline)] print:rounded-none print:border-black">
            <table className="table w-full print:text-xs">
              <thead>
                <tr>
                  <th>รายวิชา</th>
                  <th>ผู้สอน</th>
                  <th className="text-right">คะแนน</th>
                  <th className="text-right">%</th>
                  <th className="text-right">เกรด</th>
                  <th className="text-right">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {courseRows.map((course) => (
                  <tr key={course.row.courseOfferingId}>
                    <td>
                      <Link
                        href={`/student/courses/${course.row.courseOfferingId}/scores`}
                        className="font-semibold text-ink hover:text-blue-700 hover:no-underline"
                      >
                        {course.row.name}
                      </Link>
                      <CourseMetadata row={course.row} />
                    </td>
                    <td className="text-ink-soft">
                      {course.row.teacherFirstName} {course.row.teacherLastName}
                    </td>
                    <td className="text-right tabular-nums">
                      {course.status === "NO_SCORES" ? (
                        <span className="text-ink-faint">-</span>
                      ) : (
                        <>
                          {course.scoreSum}
                          <span className="text-ink-faint">
                            /{course.fullSum}
                          </span>
                        </>
                      )}
                    </td>
                    <td className="text-right tabular-nums">
                      {course.percent === null
                        ? "-"
                        : formatPercent(course.percent)}
                    </td>
                    <td className="text-right font-semibold tabular-nums">
                      {course.grade === null ? "-" : course.grade.toFixed(1)}
                    </td>
                    <td className="text-right">
                      <CourseStatusBadge status={course.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-xs text-ink-faint print:hidden">
          เกรดจะแสดงเมื่อครูเผยแพร่คะแนนครบทุกชิ้นของรายวิชานั้น
        </p>
      </section>

      <p className="hidden text-[10px] text-black/60 print:block">
        Beagle Classroom · เอกสารผลการเรียนรายวิชา
      </p>
    </div>
  );
}

function ResultTab({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors hover:no-underline ${
        active
          ? "bg-surface text-ink shadow-sm"
          : "text-ink-soft hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}

function CourseMetadata({ row }: { row: StudentLearningResultRow }) {
  const parts = [
    row.subjectCode,
    row.learnerGroupLabel,
    row.academicPeriodLabel,
    row.creditHours === null ? null : `${row.creditHours} หน่วยกิต`,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <p className="mt-0.5 max-w-md text-xs text-ink-faint">
      {parts.join(" · ")}
    </p>
  );
}

function EmptyResults({ view }: { view: "active" | "archive" }) {
  const Icon = view === "active" ? BookOpen : Archive;
  return (
    <div className="card-flat flex items-center justify-center p-10 text-center">
      <div>
        <Icon className="mx-auto h-8 w-8 text-ink-faint" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium">
          {view === "active"
            ? "ยังไม่มีรายวิชาที่กำลังเรียน"
            : "ยังไม่มีประวัติรายวิชา"}
        </p>
        <p className="mt-1 text-xs text-ink-soft">
          {view === "active"
            ? "เข้าร่วมรายวิชาด้วยรหัสที่ได้รับจากครู"
            : "รายวิชาที่ออกหรือถูกเก็บถาวรจะแสดงที่นี่"}
        </p>
      </div>
    </div>
  );
}

function CourseStatusBadge({ status }: { status: CourseRowStatus }) {
  if (status === "FINAL") {
    return <span className="badge badge-success">ประกาศครบแล้ว</span>;
  }
  if (status === "UPDATING") {
    return <span className="badge badge-warn">กำลังอัปเดต</span>;
  }
  return (
    <span className="badge">
      <Award className="h-3 w-3" aria-hidden="true" />
      ยังไม่มีคะแนน
    </span>
  );
}

function parseThresholds(raw: unknown): readonly GradeThreshold[] {
  if (!Array.isArray(raw)) return DEFAULT_GRADE_THRESHOLDS;
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
  return parsed.length === 0
    ? DEFAULT_GRADE_THRESHOLDS
    : parsed.sort((a, b) => b.minPercent - a.minPercent);
}
