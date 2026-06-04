"use client";

import { useActionState } from "react";
import {
  submitVersionAction,
  type SubmitVersionState,
} from "@/app/student/courses/[id]/assignments/actions";

/**
 * Student submit form (Phase 6 · P6-6).
 *
 * Initial submit or voluntary resubmit. Each successful submit creates
 * a new SubmissionVersion via lib/assignment.submitVersion. Pattern 6
 * (hidden submissionId / assignmentId / courseId), Pattern 8 (server
 * action async export).
 *
 * Per-channel allow* state is passed in as props — fields that the
 * Assignment did not enable are hidden entirely. Files deferred to
 * post-P6-3d wiring (lib/storage commit handshake works but the
 * SubmissionVersion.fileAttachmentIds storage decision is pending).
 *
 * The "หากเคยส่งแล้ว ครูจะเห็นเวอร์ชันล่าสุด" copy + the resubmit
 * confirmation pattern is intentionally a textual cue rather than a
 * native <dialog> — Pattern 7 is reserved for actions with side effects
 * the student should explicitly acknowledge; we still warn but do not
 * block voluntary resubmit (ADR-0020 § 3 V1 lock).
 */
export function SubmitVersionForm({
  courseId,
  assignmentId,
  submissionId,
  allowText,
  allowLink,
  hasExistingCurrent,
}: {
  courseId: string;
  assignmentId: string;
  submissionId: string;
  allowText: boolean;
  allowLink: boolean;
  hasExistingCurrent: boolean;
}) {
  const [state, formAction, isPending] = useActionState<
    SubmitVersionState,
    FormData
  >(submitVersionAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="submissionId" value={submissionId} />

      {hasExistingCurrent && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          คุณส่งงานนี้ไปแล้ว — การส่งใหม่จะแทนที่เป็นเวอร์ชันใหม่
          (ครูเห็นประวัติทุกเวอร์ชัน)
        </p>
      )}

      {allowText && (
        <div>
          <label className="block text-xs font-medium text-black/70">
            ข้อความ
          </label>
          <textarea
            name="textContent"
            rows={6}
            maxLength={50_000}
            className="input mt-1 font-mono text-xs"
            placeholder="พิมพ์คำตอบ / คำอธิบายที่นี่"
          />
          {state.fieldErrors?.textContent && (
            <p className="mt-1 text-xs text-rose-600">
              {state.fieldErrors.textContent}
            </p>
          )}
        </div>
      )}

      {allowLink && (
        <div>
          <label className="block text-xs font-medium text-black/70">
            ลิงก์ (แต่ละลิงก์ขึ้นบรรทัดใหม่ · สูงสุด 10)
          </label>
          <textarea
            name="links"
            rows={3}
            className="input mt-1 font-mono text-xs"
            placeholder="https://docs.google.com/..."
          />
          {state.fieldErrors?.links && (
            <p className="mt-1 text-xs text-rose-600">
              {state.fieldErrors.links}
            </p>
          )}
        </div>
      )}

      {state.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {state.error === "submission_closed"
            ? "ครูปิดการส่งแล้ว — ไม่สามารถส่งงานนี้ได้"
            : state.error === "auto_closed_at_due"
              ? "เลยกำหนดส่งและการส่งอัตโนมัติปิดแล้ว"
              : state.error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          className="btn-primary btn-sm"
          disabled={isPending}
        >
          {isPending
            ? "กำลังส่ง…"
            : hasExistingCurrent
              ? "ส่งใหม่ (แทนที่เวอร์ชันเก่า)"
              : "ส่งงาน"}
        </button>
      </div>
    </form>
  );
}
