import { notFound, redirect } from "next/navigation";
import { Award, FileText, Lock } from "lucide-react";
import { assert } from "@/lib/auth/guards";
import { getCourseOfferingForStudent } from "@/lib/course/queries";
import { getOwnScoresForStudent } from "@/lib/scoring/queries";
import {
  scoreTotal,
  gradeFor,
  type ScoreItemForCalculation,
  type ScoreEntryForCalculation,
} from "@/lib/scoring/calc";
import { formatPercent, formatGpa } from "@/lib/scoring/format";
import { CourseShell } from "@/components/course/course-shell";
import { studentCourseTabs } from "../_tabs";

// Auth-gated DB-fetching page — skip static prerender.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StudentScoresPage({ params }: PageProps) {
  const { id } = await params;

  // L1 gate (Pattern 4): assert.isActiveCourseMember + DB-layer projection in
  // getOwnScoresForStudent ensure peer scores never leave the DB.
  let guard;
  try {
    guard = await assert.isActiveCourseMember(id);
  } catch {
    redirect("/dashboard");
  }

  const [course, result] = await Promise.all([
    getCourseOfferingForStudent(id, guard.session.user.id),
    getOwnScoresForStudent(id, guard.session.user.id),
  ]);
  if (!course) notFound();

  const { items, totalItems, publishedItems } = result;

  // Project to the PURE score-total shape. Each rendered item is
  // already known to be published, but we keep `publishedAt` non-null so
  // calc treats it as such.
  const calcItems: ScoreItemForCalculation[] = items.map((it) => ({
    id: it.id,
    fullScore: it.fullScore,
    publishedAt: it.publishedAt,
  }));
  const calcEntries: ScoreEntryForCalculation[] = items
    .filter((it) => it.myValue !== null)
    .map((it) => ({ scoreItemId: it.id, value: it.myValue as number }));

  const percent = scoreTotal(calcItems, calcEntries);
  // เกรดรายวิชา is only meaningful when publish is COMPLETE for this
  // course — never fake a final grade from partial data (CONTEXT §
  // Learning Results). Until then the running % renders with a
  // "กำลังอัปเดต" badge.
  const isComplete = totalItems > 0 && publishedItems === totalItems;
  const grade = isComplete && percent !== null ? gradeFor(percent) : null;
  const hasAnyPublished = publishedItems > 0;

  return (
    <CourseShell
      session={guard.session}
      course={course}
      eyebrow="ห้องเรียน"
      backHref="/dashboard"
      tabs={studentCourseTabs(id)}
    >
      <div className="space-y-4">
        {/* KPI card */}
        <div className="card p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-xs font-medium text-black/50">
                คะแนนรวมของวิชานี้
                {hasAnyPublished && !isComplete && (
                  <span className="inline-flex rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700">
                    กำลังอัปเดต
                  </span>
                )}
              </p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-black">
                {hasAnyPublished ? formatPercent(percent) : "ยังไม่มีคะแนน"}
              </p>
              {hasAnyPublished && !isComplete && (
                <p className="mt-1 text-xs text-black/50">
                  คิดจากคะแนนที่ครูประกาศแล้ว —
                  เกรดวิชาจะแสดงเมื่อครูประกาศครบทุกรายการ
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-black/50">เกรดวิชา</p>
              <p
                className={
                  "mt-1 text-3xl font-bold tracking-tight " +
                  (grade !== null ? "text-blue-700" : "text-black/30")
                }
              >
                {grade !== null ? formatGpa(grade) : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Item list */}
        <div className="card p-6">
          <h2
            className="mb-3 text-lg font-medium text-black"
            style={{ letterSpacing: "-0.02em" }}
          >
            รายการคะแนน
          </h2>

          {totalItems === 0 ? (
            <EmptyState />
          ) : items.length === 0 ? (
            <NotYetPublishedState totalItems={totalItems} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((it) => {
                const percentOfFull =
                  it.myValue === null
                    ? null
                    : (it.myValue / it.fullScore) * 100;
                return (
                  <li key={it.id} className="-mx-2 px-2 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-medium text-black">
                          <FileText className="h-4 w-4 shrink-0 text-black/30" />
                          {it.name}
                        </p>
                        <p className="mt-0.5 text-xs text-black/50">
                          คะแนนเต็ม {it.fullScore}
                        </p>
                        {it.myNote && (
                          <p className="mt-1 truncate text-xs text-black/70">
                            บันทึก: {it.myNote}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        {it.myValue === null ? (
                          <p className="text-sm text-black/30">—</p>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-black">
                              {it.myValue}
                              <span className="text-black/40">
                                {" "}
                                / {it.fullScore}
                              </span>
                            </p>
                            <p className="text-xs text-black/40">
                              {formatPercent(percentOfFull)}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {publishedItems < totalItems && totalItems > 0 && (
          <div className="card-flat flex items-start gap-3 p-4">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-black/40" />
            <p className="text-xs text-black/60">
              ยังมีรายการคะแนน {totalItems - publishedItems}{" "}
              รายการที่ครูยังไม่เผยแพร่ — จะแสดงให้อัตโนมัติเมื่อครูเผยแพร่
            </p>
          </div>
        )}
      </div>
    </CourseShell>
  );
}

function EmptyState() {
  return (
    <div className="card-flat flex items-center justify-center p-8 text-center">
      <div>
        <Award className="mx-auto mb-2 h-8 w-8 text-black/20" />
        <p className="text-sm text-black/60">วิชานี้ยังไม่มีรายการคะแนน</p>
      </div>
    </div>
  );
}

function NotYetPublishedState({ totalItems }: { totalItems: number }) {
  return (
    <div className="card-flat flex items-center justify-center p-8 text-center">
      <div>
        <Lock className="mx-auto mb-2 h-8 w-8 text-black/20" />
        <p className="text-sm text-black/60">
          มีรายการคะแนน {totalItems} รายการ แต่ครูยังไม่เผยแพร่
        </p>
        <p className="mt-1 text-xs text-black/40">
          จะแสดงให้อัตโนมัติเมื่อครูเผยแพร่
        </p>
      </div>
    </div>
  );
}
