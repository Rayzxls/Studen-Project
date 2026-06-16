"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  hideVersionAction,
  type HideVersionState,
} from "@/app/student/courses/[id]/assignments/actions";

/**
 * Per-version "remove from my list" control (soft-hide, ADR-0020).
 *
 * Two-step inline confirm (no window.confirm). On success the server action
 * revalidates the page and the row disappears (the student query filters
 * hidden versions). The version is never destroyed — the teacher + audit
 * still see it; this only declutters the student's own history.
 */
export function HideVersionButton({
  courseId,
  assignmentId,
  submissionId,
  versionId,
  label,
}: {
  courseId: string;
  assignmentId: string;
  submissionId: string;
  versionId: string;
  label: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, isPending] = useActionState<
    HideVersionState,
    FormData
  >(hideVersionAction, {});

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-black/35 transition hover:bg-red-50 hover:text-red-700"
        aria-label={`ลบ${label} ออกจากรายการของฉัน`}
        title="ลบออกจากรายการของฉัน"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="submissionId" value={submissionId} />
      <input type="hidden" name="versionId" value={versionId} />
      <span className="text-[11px] text-black/55">ลบออกจากรายการ?</span>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
      >
        {isPending ? "กำลังลบ…" : "ลบ"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={isPending}
        className="rounded-full px-2 py-0.5 text-[11px] text-black/55 transition hover:bg-black/[0.05]"
      >
        ยกเลิก
      </button>
      {state.error && (
        <span className="text-[11px] text-red-700">
          {state.error === "cannot_hide_current_version"
            ? "ลบครั้งล่าสุดไม่ได้"
            : "ลบไม่สำเร็จ ลองใหม่"}
        </span>
      )}
    </form>
  );
}
