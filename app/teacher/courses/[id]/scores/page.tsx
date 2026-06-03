import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, FileText } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { db } from "@/lib/db/client";
import { validateWeights } from "@/lib/scoring/score-item";
import { formatBasisPoints } from "@/lib/scoring/format";
import { CourseShell } from "@/components/course/course-shell";
import { CreateScoreItemForm } from "@/components/scoring/create-score-item-form";
import { PublishScoreItemDialog } from "@/components/scoring/publish-score-item-dialog";
import { DeleteScoreItemDialog } from "@/components/scoring/delete-score-item-dialog";
import { teacherCourseTabs } from "../_tabs";

// Auth-gated DB-fetching page — skip static prerender.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ScoresListPage({ params }: PageProps) {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;
  const course = await getCourseOfferingForTeacher(id, session.user.id);
  if (!course) notFound();

  // Authorization is already enforced by getCourseOfferingForTeacher (which
  // checks teacherId); reads below are scoped to this CourseOffering.
  const [items, activeMemberCount] = await Promise.all([
    db.scoreItem.findMany({
      where: { courseOfferingId: id },
      select: {
        id: true,
        name: true,
        fullScore: true,
        weight: true,
        position: true,
        publishedAt: true,
        _count: { select: { entries: true } },
      },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    }),
    db.enrollment.count({
      where: { courseOfferingId: id, removedAt: null },
    }),
  ]);

  const { sum, isValid } = validateWeights(items);
  const allPublished =
    items.length > 0 && items.every((it) => it.publishedAt !== null);

  return (
    <CourseShell
      course={course}
      eyebrow="รายวิชาที่สอน"
      backHref="/teacher/courses"
      tabs={teacherCourseTabs(id)}
    >
      <div className="card p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              className="text-lg font-medium text-black"
              style={{ letterSpacing: "-0.02em" }}
            >
              รายการคะแนน
            </h2>
            <p className="mt-0.5 text-xs text-black/50">
              {items.length === 0
                ? "ยังไม่มีรายการ"
                : `${items.length} รายการ · ${items.filter((it) => it.publishedAt !== null).length} เผยแพร่แล้ว`}
            </p>
          </div>
          <CreateScoreItemForm courseId={id} currentSumBp={sum} />
        </div>

        {/* Weight Σ pill — green at 100%, amber otherwise. */}
        <div className="mb-4">
          <WeightSumPill sum={sum} isValid={isValid} />
          {allPublished && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" />
              เผยแพร่ครบทุกรายการ
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((it) => {
              const published = it.publishedAt !== null;
              return (
                <li key={it.id} className="-mx-2 flex items-center gap-2 px-2">
                  <Link
                    href={`/teacher/courses/${id}/scores/${it.id}`}
                    className="-mx-2 flex flex-1 items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-slate-50/60"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm font-medium text-black">
                        <FileText className="h-4 w-4 shrink-0 text-black/30" />
                        {it.name}
                        {published ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">
                            เผยแพร่แล้ว
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                            ร่าง
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-black/50">
                        น้ำหนัก {formatBasisPoints(it.weight)} · คะแนนเต็ม{" "}
                        {it.fullScore} · {it._count.entries} คะแนน
                      </p>
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1">
                    {!published && (
                      <PublishScoreItemDialog
                        courseId={id}
                        scoreItemId={it.id}
                        scoreItemName={it.name}
                        weight={it.weight}
                        fullScore={it.fullScore}
                        entriesCount={it._count.entries}
                        activeMemberCount={activeMemberCount}
                        currentSumBp={sum}
                      />
                    )}
                    <DeleteScoreItemDialog
                      courseId={id}
                      scoreItemId={it.id}
                      scoreItemName={it.name}
                      isPublished={published}
                      entriesCount={it._count.entries}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </CourseShell>
  );
}

function WeightSumPill({ sum, isValid }: { sum: number; isValid: boolean }) {
  const label = formatBasisPoints(sum);
  if (isValid) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
        Σ น้ำหนัก = {label}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200"
      title="น้ำหนักรวมต้องเท่ากับ 100% ก่อนเผยแพร่"
    >
      Σ น้ำหนัก = {label} (ต้องเท่ากับ 100% ก่อนเผยแพร่)
    </span>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
      <p className="text-sm text-black/60">ยังไม่มีรายการคะแนน</p>
      <p className="mt-1 text-xs text-black/40">
        กด &ldquo;เพิ่มรายการคะแนน&rdquo; ด้านบนเพื่อสร้างช่องคะแนนแรก (เช่น
        สอบกลางภาค, การบ้าน)
      </p>
    </div>
  );
}
