import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { assert } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { getScoreItemGridForTeacher } from "@/lib/scoring/queries";
import { formatBasisPoints } from "@/lib/scoring/format";
import { CourseShell } from "@/components/course/course-shell";
import { ScoreGrid, type ScoreGridRow } from "@/components/scoring/score-grid";
import { teacherCourseTabs } from "../../_tabs";

// Auth-gated DB-fetching page — skip static prerender.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string; scoreItemId: string }>;
}

export default async function ScoreItemGridPage({ params }: PageProps) {
  const { id, scoreItemId } = await params;

  // Authz first — returns { session, item } so we know publishedAt early.
  let guard;
  try {
    guard = await assert.canMutateScoreItem(scoreItemId);
  } catch {
    redirect(`/teacher/courses/${id}/scores`);
  }

  // URL sanity: ScoreItem belongs to the URL course (tampering / stale link).
  if (guard.item.courseOfferingId !== id) {
    redirect(
      `/teacher/courses/${guard.item.courseOfferingId}/scores/${scoreItemId}`
    );
  }

  const [course, grid] = await Promise.all([
    getCourseOfferingForTeacher(id, guard.session.user.id),
    getScoreItemGridForTeacher(scoreItemId, guard.session.user.id),
  ]);
  if (!course || !grid) notFound();

  const isPublished = grid.item.publishedAt !== null;

  const rows: ScoreGridRow[] = grid.rows.map((r) => ({
    enrollmentId: r.enrollmentId,
    removed: r.removedAt !== null,
    studentName: `${r.firstName} ${r.lastName}`,
    studentIdNumber: r.studentId,
    initialValue: r.value,
    initialNote: r.note,
    editCount: r.editCount,
  }));

  return (
    <CourseShell
      course={course}
      eyebrow="รายวิชาที่สอน"
      backHref="/teacher/courses"
      tabs={teacherCourseTabs(id)}
    >
      <div className="space-y-4">
        <Link
          href={`/teacher/courses/${id}/scores`}
          className="inline-flex items-center gap-1 text-xs text-black/60 hover:text-black"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          กลับไปรายการคะแนน
        </Link>

        <div className="card p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2
                className="text-lg font-medium text-black"
                style={{ letterSpacing: "-0.02em" }}
              >
                {grid.item.name}
                {isPublished ? (
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                    เผยแพร่แล้ว
                  </span>
                ) : (
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    ร่าง
                  </span>
                )}
              </h2>
              <p className="mt-0.5 text-xs text-black/50">
                น้ำหนัก {formatBasisPoints(grid.item.weight)} · คะแนนเต็ม{" "}
                {grid.item.fullScore}
              </p>
            </div>
          </div>

          <ScoreGrid
            courseId={id}
            scoreItemId={scoreItemId}
            fullScore={grid.item.fullScore}
            isPublished={isPublished}
            rows={rows}
          />
        </div>
      </div>
    </CourseShell>
  );
}
