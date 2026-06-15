import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CheckCircle2,
  ClipboardCheck,
  FileText,
  PencilLine,
} from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { db } from "@/lib/db/client";
import { gradeForCourseOffering, scoreTotal } from "@/lib/scoring/calc";
import { formatPercent } from "@/lib/scoring/format";
import { CourseShell } from "@/components/course/course-shell";
import { CreateScoreItemForm } from "@/components/scoring/create-score-item-form";
import { PublishScoreItemDialog } from "@/components/scoring/publish-score-item-dialog";
import { DeleteScoreItemDialog } from "@/components/scoring/delete-score-item-dialog";
import { teacherCourseTabs } from "../_tabs";

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

  const [items, enrollments, activeMemberCount] = await Promise.all([
    db.scoreItem.findMany({
      where: { courseOfferingId: id },
      select: {
        id: true,
        name: true,
        fullScore: true,
        source: true,
        position: true,
        publishedAt: true,
        assignment: { select: { id: true } },
        _count: { select: { entries: true } },
      },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    }),
    db.enrollment.findMany({
      where: {
        courseOfferingId: id,
        OR: [
          { removedAt: null },
          { scoreEntries: { some: { scoreItem: { courseOfferingId: id } } } },
        ],
      },
      select: {
        id: true,
        removedAt: true,
        student: {
          select: {
            studentId: true,
            firstName: true,
            lastName: true,
          },
        },
        scoreEntries: {
          where: { scoreItem: { courseOfferingId: id } },
          select: { scoreItemId: true, value: true },
        },
      },
      orderBy: [
        { student: { firstName: "asc" } },
        { student: { lastName: "asc" } },
      ],
    }),
    db.enrollment.count({
      where: { courseOfferingId: id, removedAt: null },
    }),
  ]);

  const publishedItems = items.filter((item) => item.publishedAt !== null);
  const fullScoreSum = items.reduce((acc, item) => acc + item.fullScore, 0);
  const publishedFullScore = publishedItems.reduce(
    (sum, item) => sum + Math.max(0, item.fullScore),
    0
  );
  const allPublished =
    items.length > 0 && items.every((item) => item.publishedAt !== null);

  return (
    <CourseShell
      session={session}
      course={course}
      eyebrow="รายวิชาที่สอน"
      backHref="/teacher/courses"
      tabs={teacherCourseTabs(id)}
    >
      <div className="space-y-4">
        <section className="card p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium tracking-tight text-black">
                คะแนนและเกรดรายวิชา
              </h2>
              <p className="mt-1 text-xs text-black/50">
                แยกให้เห็นว่านักเรียนได้คะแนนจากส่วนไหนบ้าง ·
                งานส่งให้ไปตรวจในหน้าตรวจงาน
                ส่วนคะแนนครูกรอกเองยังแก้ได้ในสมุดคะแนน
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CreateScoreItemForm courseId={id} />
              <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                คะแนนเต็มรวม {fullScoreSum}
              </span>
              {allPublished && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-500 px-3 py-1 text-xs font-semibold text-white shadow-sm ring-1 ring-black/10">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  เผยแพร่ครบ
                </span>
              )}
            </div>
          </div>

          {items.length === 0 ? (
            <EmptyState />
          ) : enrollments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/15 p-8 text-center text-sm text-black/50">
              ยังไม่มีนักเรียนให้แสดงคะแนน
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-black/[0.08]">
              <table className="table w-full min-w-[900px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-surface">นักเรียน</th>
                    {items.map((item) => {
                      const target = scoreItemTarget(id, item);
                      return (
                        <th key={item.id} className="text-right">
                          <span className="mb-1 inline-flex rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-medium text-ink-soft">
                            {scoreItemKindLabel(item)}
                          </span>
                          <Link
                            href={target.href}
                            className="block max-w-[140px] truncate text-black hover:underline"
                          >
                            {item.name}
                          </Link>
                          <span className="mt-0.5 block text-[10px] font-normal text-ink-soft">
                            /{item.fullScore} ·{" "}
                            {item.publishedAt ? "ประกาศแล้ว" : "ร่าง"}
                          </span>
                        </th>
                      );
                    })}
                    <th className="text-right">คะแนนรวม</th>
                    <th className="text-right">%</th>
                    <th className="text-right">เกรด</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((enrollment) => {
                    const entries = enrollment.scoreEntries.map((entry) => ({
                      scoreItemId: entry.scoreItemId,
                      value: entry.value,
                    }));
                    const entryByItem = new Map(
                      entries.map((entry) => [entry.scoreItemId, entry.value])
                    );
                    const scoreSum = publishedItems.reduce((sum, item) => {
                      if (item.fullScore <= 0) return sum;
                      return sum + (entryByItem.get(item.id) ?? 0);
                    }, 0);
                    const percent = scoreTotal(items, entries);
                    const grade = gradeForCourseOffering(items, entries);

                    return (
                      <tr key={enrollment.id}>
                        <td className="sticky left-0 z-10 bg-surface">
                          <p className="font-medium text-black">
                            {enrollment.student.firstName}{" "}
                            {enrollment.student.lastName}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] text-ink-soft">
                            {enrollment.student.studentId}
                            {enrollment.removedAt && " · ออกจากรายวิชาแล้ว"}
                          </p>
                        </td>
                        {items.map((item) => {
                          const value = entryByItem.get(item.id);
                          return (
                            <td
                              key={item.id}
                              className={
                                "text-right text-sm " +
                                (item.publishedAt ? "" : "text-ink-soft")
                              }
                            >
                              {value ?? "—"}
                            </td>
                          );
                        })}
                        <td className="text-right text-sm font-medium">
                          {scoreSum}/{publishedFullScore || 0}
                        </td>
                        <td className="text-right text-sm">
                          {percent === null ? "—" : formatPercent(percent)}
                        </td>
                        <td className="text-right text-sm font-semibold text-blue-600">
                          {grade.grade === null ? "—" : grade.grade.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {items.length > 0 && (
          <section className="card p-6">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-black">
              <FileText className="h-4 w-4 text-blue-600" />
              รายการคะแนนทั้งหมด
            </h2>
            <ul className="divide-y divide-black/[0.06]">
              {items.map((item) => {
                const published = item.publishedAt !== null;
                const target = scoreItemTarget(id, item);
                const isAssignmentLinked = item.source === "ASSIGNMENT_LINKED";
                return (
                  <li
                    key={item.id}
                    className="-mx-2 flex items-center gap-2 px-2"
                  >
                    <Link
                      href={target.href}
                      className="-mx-2 flex flex-1 items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-slate-50/60"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-black">
                            {item.name}
                          </p>
                          <span
                            className={
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 " +
                              (isAssignmentLinked
                                ? "bg-blue-500/10 text-blue-700 ring-blue-500/15"
                                : "bg-black/[0.04] text-ink-soft ring-black/[0.06]")
                            }
                          >
                            {isAssignmentLinked ? (
                              <ClipboardCheck className="h-3 w-3" />
                            ) : (
                              <PencilLine className="h-3 w-3" />
                            )}
                            {scoreItemKindLabel(item)}
                          </span>
                          {published ? (
                            <span className="rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm ring-1 ring-black/10">
                              เผยแพร่แล้ว
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                              ร่าง
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-black/50">
                          คะแนนเต็ม {item.fullScore} · บันทึกคะแนนแล้ว{" "}
                          {item._count.entries.toLocaleString("th-TH")} รายการ ·{" "}
                          {target.hint}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-500/10">
                        {target.actionLabel}
                      </span>
                    </Link>
                    <div className="flex shrink-0 items-center gap-1">
                      {!published && (
                        <PublishScoreItemDialog
                          courseId={id}
                          scoreItemId={item.id}
                          scoreItemName={item.name}
                          fullScore={item.fullScore}
                          entriesCount={item._count.entries}
                          activeMemberCount={activeMemberCount}
                        />
                      )}
                      <DeleteScoreItemDialog
                        courseId={id}
                        scoreItemId={item.id}
                        scoreItemName={item.name}
                        isPublished={published}
                        entriesCount={item._count.entries}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </CourseShell>
  );
}

type ScoreItemListItem = {
  id: string;
  source: "MANUAL" | "ASSIGNMENT_LINKED";
  assignment: { id: string } | null;
};

function scoreItemKindLabel(item: ScoreItemListItem): string {
  return item.source === "ASSIGNMENT_LINKED" ? "งานส่ง" : "คะแนนครูกรอกเอง";
}

function scoreItemTarget(courseId: string, item: ScoreItemListItem) {
  if (item.source === "ASSIGNMENT_LINKED" && item.assignment) {
    return {
      href: `/teacher/courses/${courseId}/assignments/${item.assignment.id}`,
      actionLabel: "ไปตรวจงาน",
      hint: "ตรวจไฟล์ คอมเมนต์ และยืนยันคะแนนในหน้าตรวจงาน",
    };
  }

  return {
    href: `/teacher/courses/${courseId}/scores/${item.id}`,
    actionLabel: "กรอกคะแนน",
    hint: "กรอกหรือแก้คะแนนได้ในสมุดคะแนน",
  };
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
      <p className="text-sm text-black/60">ยังไม่มีรายการคะแนน</p>
      <p className="mt-1 text-xs text-black/40">
        กด &ldquo;เพิ่มรายการคะแนน&rdquo; ด้านบนเพื่อสร้างช่องคะแนนแรก
      </p>
    </div>
  );
}
