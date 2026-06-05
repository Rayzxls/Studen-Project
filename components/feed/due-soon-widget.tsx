import Link from "next/link";
import { AlertCircle, Clock } from "lucide-react";
import { getDueSoonForStudent } from "@/lib/assignment/due-soon";
import { formatThaiDateShort } from "@/lib/attendance/format";

/**
 * Due Soon Widget — Phase 7 · P7-6 · STUDENT ONLY
 *
 * CONTEXT § Due Soon Widget: state-derived list, not a Notification
 * kind / Feed entry. Pulls Assignment WHERE dueAt is within 24 h +
 * own Submission status ∈ {NOT_SUBMITTED, DRAFT}. Re-evaluated every
 * dashboard render — no cron, no materialised row.
 *
 * Layout per Q2 = A: sits ABOVE the User Feed in the single-column
 * student dashboard.
 *
 * Hides itself when there are zero matching rows. Zero items
 * intentionally means "no urgent items right now" — we do not show
 * an explicit empty state here (an empty Due Soon card would be
 * confusing next to a populated User Feed).
 */
export async function DueSoonWidget({
  studentUserId,
}: {
  studentUserId: string;
}) {
  const items = await getDueSoonForStudent(studentUserId);
  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
      <div className="mb-3 flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-amber-700" aria-hidden="true" />
        <h2
          className="text-sm font-medium text-amber-900"
          style={{ letterSpacing: "-0.01em" }}
        >
          ใกล้ส่ง — ภายใน 24 ชั่วโมง ({items.length})
        </h2>
      </div>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.id}>
            <Link
              href={`/student/courses/${it.courseOfferingId}/assignments/${it.id}`}
              className="flex items-start justify-between gap-3 rounded-xl bg-white/70 px-3 py-2.5 transition-colors hover:bg-white hover:no-underline"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-black">
                  {it.title}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-black/60">
                  {it.courseName}
                  {it.hasDraft && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-black/[0.05] px-1.5 py-0.5 text-[10px] text-black/60">
                      ร่าง
                    </span>
                  )}
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-amber-800">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {formatThaiDateShort(it.dueAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
