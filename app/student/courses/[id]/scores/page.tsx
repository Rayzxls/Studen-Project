import { notFound, redirect } from "next/navigation";
import { Award, FileText, Lock, ShieldCheck } from "lucide-react";
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
  const lockedItems = totalItems - publishedItems;

  // Earned vs. full points across published items — the "เก็บแล้ว x จาก y"
  // reading that students actually reconcile against their notebook.
  const earnedPoints = items.reduce((sum, it) => sum + (it.myValue ?? 0), 0);
  const fullPoints = items.reduce((sum, it) => sum + it.fullScore, 0);

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
        <div className="card p-5 md:p-6">
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
              <p
                className="mt-1 text-3xl font-semibold tracking-tight text-black"
                style={{ letterSpacing: "-0.02em" }}
              >
                {hasAnyPublished ? (
                  <>
                    {earnedPoints}
                    <span className="text-xl font-medium text-black/40">
                      {" "}
                      / {fullPoints} คะแนน
                    </span>
                  </>
                ) : (
                  "ยังไม่มีคะแนน"
                )}
              </p>
              {hasAnyPublished && (
                <p className="mt-1 text-xs text-black/50">
                  คิดเป็น {formatPercent(percent)} · ประกาศแล้ว {publishedItems}
                  /{totalItems} รายการ
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-black/50">เกรดวิชา</p>
              <p
                className={
                  "mt-1 text-3xl font-semibold tracking-tight " +
                  (grade !== null ? "text-blue-700" : "text-black/30")
                }
              >
                {grade !== null ? formatGpa(grade) : "—"}
              </p>
            </div>
          </div>

          {/* Overall progress bar over published items. */}
          {hasAnyPublished && percent !== null && (
            <div
              className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-black/[0.05]"
              role="img"
              aria-label={`คะแนนรวม ${formatPercent(percent)}`}
            >
              <div
                className="h-full rounded-full bg-blue-500"
                style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
              />
            </div>
          )}

          {hasAnyPublished && !isComplete && (
            <p className="mt-3 text-xs text-black/50">
              คิดจากคะแนนที่ครูประกาศแล้ว —
              เกรดวิชาจะแสดงเมื่อครูประกาศครบทุกรายการ
            </p>
          )}

          {/* Privacy affordance — L1 visibility made visible (PRODUCT.md
              principle 5). */}
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-blue-50 px-3.5 py-2.5 text-xs leading-relaxed text-blue-700">
            <ShieldCheck
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            คะแนนทั้งหมดในหน้านี้เห็นได้เฉพาะเราเท่านั้น
            เพื่อนร่วมห้องมองไม่เห็นคะแนนของเรา
          </p>
        </div>

        {/* Item list */}
        <div className="card p-5 md:p-6">
          <header className="flex items-baseline justify-between gap-3">
            <h2
              className="text-base font-medium text-black"
              style={{ letterSpacing: "-0.02em" }}
            >
              รายการคะแนน
            </h2>
            {items.length > 0 && (
              <span className="text-xs text-black/50">
                {items.length} รายการ
              </span>
            )}
          </header>

          {totalItems === 0 ? (
            <EmptyState />
          ) : items.length === 0 ? (
            <NotYetPublishedState totalItems={totalItems} />
          ) : (
            <ul className="mt-2 divide-y divide-black/5">
              {items.map((it) => {
                const percentOfFull =
                  it.myValue === null
                    ? null
                    : (it.myValue / it.fullScore) * 100;
                return (
                  <li key={it.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                          <FileText className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-black">
                            {it.name}
                          </p>
                          {/* Per-item progress bar — value over full. */}
                          <div className="mt-1.5 h-1.5 w-full max-w-56 overflow-hidden rounded-full bg-black/[0.05]">
                            <div
                              className={
                                "h-full rounded-full " +
                                (percentOfFull === null
                                  ? "bg-black/10"
                                  : "bg-blue-500")
                              }
                              style={{
                                width: `${
                                  percentOfFull === null
                                    ? 0
                                    : Math.min(100, Math.max(0, percentOfFull))
                                }%`,
                              }}
                            />
                          </div>
                          {it.myNote && (
                            <p className="mt-1.5 truncate text-xs text-black/70">
                              บันทึกจากครู: {it.myNote}
                            </p>
                          )}
                        </div>
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

        {lockedItems > 0 && totalItems > 0 && items.length > 0 && (
          <div className="card-flat flex items-center gap-3 p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-black/50">
              <Lock className="h-4 w-4" aria-hidden="true" />
            </span>
            <p className="text-xs leading-relaxed text-black/60">
              ยังมีรายการคะแนน {lockedItems} รายการที่ครูยังไม่เผยแพร่ —
              จะแสดงให้อัตโนมัติเมื่อครูเผยแพร่
            </p>
          </div>
        )}
      </div>
    </CourseShell>
  );
}

function EmptyState() {
  return (
    <div className="mt-3 rounded-xl border border-dashed border-black/15 p-8 text-center">
      <Award
        className="mx-auto mb-2 h-8 w-8 text-black/25"
        aria-hidden="true"
      />
      <p className="text-sm font-medium text-black">
        วิชานี้ยังไม่มีรายการคะแนน
      </p>
      <p className="mt-1 text-xs text-black/50">
        เมื่อครูสร้างและประกาศรายการคะแนน คะแนนของเราจะปรากฏที่นี่
      </p>
    </div>
  );
}

function NotYetPublishedState({ totalItems }: { totalItems: number }) {
  return (
    <div className="mt-3 rounded-xl border border-dashed border-black/15 p-8 text-center">
      <Lock className="mx-auto mb-2 h-8 w-8 text-black/25" aria-hidden="true" />
      <p className="text-sm font-medium text-black">
        มีรายการคะแนน {totalItems} รายการ แต่ครูยังไม่เผยแพร่
      </p>
      <p className="mt-1 text-xs text-black/50">
        จะแสดงให้อัตโนมัติเมื่อครูเผยแพร่
      </p>
    </div>
  );
}
