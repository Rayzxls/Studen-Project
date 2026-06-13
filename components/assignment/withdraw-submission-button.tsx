"use client";

import { useState } from "react";
import { useActionState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  withdrawSubmissionAction,
  type WithdrawSubmissionState,
} from "@/app/student/courses/[id]/assignments/actions";

function toThaiError(error: string) {
  switch (error) {
    case "submission_closed":
      return "ครูปิดการส่งแล้ว ไม่สามารถยกเลิกการส่งได้";
    case "auto_closed_at_due":
      return "เลยกำหนดส่งและระบบปิดการส่งอัตโนมัติแล้ว";
    case "submission_already_graded":
      return "งานนี้ตรวจเสร็จแล้ว ไม่สามารถยกเลิกการส่งได้";
    case "submission_returned_resubmit_instead":
      return "ครูส่งคืนงานนี้แล้ว — แก้ไขแล้วส่งใหม่ได้เลย ไม่ต้องยกเลิก";
    case "no_current_submission":
      return "ไม่มีงานที่กำลังส่งอยู่ให้ยกเลิก";
    default:
      return error;
  }
}

/**
 * Withdraw button with an inline two-step confirm — no window.confirm.
 *
 * Step 1: a quiet ghost-style trigger ("ยกเลิกการส่ง…").
 * Step 2: the button expands into a confirm panel explaining that version
 * history survives but the work leaves the teacher's review queue, with a
 * danger confirm + a safe "ไม่ยกเลิก" escape. Both buttons are ≥ 44px tall
 * (CLAUDE.md mobile touch-target rule).
 */
export function WithdrawSubmissionButton({
  courseId,
  assignmentId,
  submissionId,
}: {
  courseId: string;
  assignmentId: string;
  submissionId: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, isPending] = useActionState<
    WithdrawSubmissionState,
    FormData
  >(withdrawSubmissionAction, {});

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="min-h-11 w-full rounded-full px-4 text-sm font-medium text-black/45 transition hover:bg-red-50 hover:text-red-700"
      >
        ยกเลิกการส่ง…
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-red-50/60 p-4 ring-1 ring-red-500/15">
      <div className="flex items-start gap-2.5">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-black">ยกเลิกการส่งงาน?</p>
          <p className="mt-1 text-xs leading-5 text-black/60">
            ประวัติงานเดิมยังอยู่ แต่ครูจะไม่เห็นเป็นงานที่รอตรวจ
            คุณส่งใหม่ได้ตลอดช่วงเวลาที่ยังเปิดรับงาน
          </p>
        </div>
      </div>

      <form action={formAction} className="mt-3 space-y-2">
        <input type="hidden" name="courseId" value={courseId} />
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <input type="hidden" name="submissionId" value={submissionId} />

        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="submit"
            disabled={isPending}
            className="btn-danger min-h-11 flex-1 justify-center text-sm"
          >
            {isPending ? "กำลังยกเลิก…" : "ยืนยันยกเลิกการส่ง"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={isPending}
            className="btn-secondary min-h-11 flex-1 justify-center text-sm"
          >
            ไม่ยกเลิก
          </button>
        </div>

        {state.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {toThaiError(state.error)}
          </p>
        )}
      </form>
    </div>
  );
}
