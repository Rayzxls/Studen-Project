"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Send } from "lucide-react";

import {
  publishNowAction,
  reschedulePublishingAction,
  type RescheduleState,
} from "@/app/teacher/courses/[id]/schedule/actions";
import { DateTimeField } from "@/components/ui/date-time-field";
import {
  formatBangkokTime,
  formatThaiDateShort,
} from "@/lib/attendance/format";
import type { ScheduledContentKind } from "@/lib/publishing/schedule";
import { formatPublishAtInput } from "@/lib/publishing/validation";

/**
 * Moving a post that has not gone live yet.
 *
 * Offered only on a scheduled item: once the class can see a post there is no
 * taking it back, so the control disappears rather than failing on submit.
 * Both choices in here — a different time, or right now — are the teacher's
 * own unpublished work, so neither asks for a reason.
 */

const KIND_LABELS: Record<ScheduledContentKind, string> = {
  ANNOUNCEMENT: "ประกาศ",
  MATERIAL: "เอกสาร",
  ASSIGNMENT: "การบ้าน",
};

const ERROR_MESSAGES: Record<string, string> = {
  already_published: "โพสต์นี้เผยแพร่ไปแล้ว — รีเฟรชหน้าเพื่อดูสถานะล่าสุด",
  not_course_owner: "ไม่มีสิทธิ์แก้ไขโพสต์ของรายวิชานี้",
  scheduled_content_not_found: "ไม่พบโพสต์นี้แล้ว",
  publish_at_must_be_future: "เลือกเวลาในอนาคต",
  invalid_publish_at: "รูปแบบวันและเวลาไม่ถูกต้อง",
  missing_ids: "ข้อมูลไม่ครบ ลองรีเฟรชหน้าอีกครั้ง",
};

function readable(message: string | undefined): string | null {
  if (!message) return null;
  return ERROR_MESSAGES[message] ?? message;
}

export function ReschedulePublishingDialog({
  courseId,
  kind,
  itemId,
  publishAt,
}: {
  courseId: string;
  kind: ScheduledContentKind;
  itemId: string;
  /** Serialized so the dialog stays usable from a server-rendered list. */
  publishAt: string;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const router = useRouter();
  const scheduled = new Date(publishAt);

  const [moveState, moveAction, isMoving] = useActionState<
    RescheduleState,
    FormData
  >(reschedulePublishingAction, {});
  const [publishState, publishNow, isPublishing] = useActionState<
    RescheduleState,
    FormData
  >(publishNowAction, {});

  const done = moveState.ok || publishState.ok;

  useEffect(() => {
    if (!done) return;
    setTimeout(() => {
      const d = dialogRef.current;
      if (!d) return;
      d.close();
      d.removeAttribute("open");
      router.refresh();
    }, 0);
  }, [done, router]);

  const label = KIND_LABELS[kind];
  const moveError =
    readable(moveState.error) ?? readable(moveState.fieldErrors?.publishAt);
  const publishError = readable(publishState.error);

  return (
    <>
      <button
        type="button"
        className="btn-ghost btn-sm cursor-pointer"
        onClick={() => dialogRef.current?.showModal()}
        aria-label={`เลื่อนเวลาเผยแพร่${label}`}
      >
        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /> เลื่อนเวลา
      </button>

      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-md rounded-2xl border border-hairline bg-surface p-0 shadow-soft backdrop:bg-black/40"
      >
        <div className="p-6">
          <h3 className="text-lg font-medium text-ink">
            เลื่อนเวลาเผยแพร่{label}
          </h3>
          <p className="mt-1 text-xs text-ink-mute">
            ตั้งไว้ {formatThaiDateShort(scheduled)} เวลา{" "}
            {formatBangkokTime(scheduled)} น. · นักเรียนยังไม่เห็นโพสต์นี้
          </p>

          <form action={moveAction} className="mt-4">
            <input type="hidden" name="courseId" value={courseId} />
            <input type="hidden" name="itemId" value={itemId} />
            <input type="hidden" name="kind" value={kind} />

            <DateTimeField
              name="publishAt"
              futureOnly
              defaultValue={formatPublishAtInput(scheduled)}
              aria-label="เวลาเผยแพร่ใหม่"
            />

            {moveError && (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                {moveError}
              </p>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => dialogRef.current?.close()}
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="btn-primary btn-sm"
                disabled={isMoving || isPublishing}
              >
                {isMoving ? "กำลังบันทึก…" : "บันทึกเวลาใหม่"}
              </button>
            </div>
          </form>

          <form
            action={publishNow}
            className="mt-5 border-t border-hairline pt-4"
          >
            <input type="hidden" name="courseId" value={courseId} />
            <input type="hidden" name="itemId" value={itemId} />
            <input type="hidden" name="kind" value={kind} />

            <p className="text-xs text-ink-mute">
              หรือไม่ต้องรอ — เผยแพร่เดี๋ยวนี้แล้วแจ้งเตือนนักเรียนทันที
            </p>

            {publishError && (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                {publishError}
              </p>
            )}

            <button
              type="submit"
              className="btn-ghost btn-sm mt-3 cursor-pointer"
              disabled={isMoving || isPublishing}
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              {isPublishing ? "กำลังเผยแพร่…" : "เผยแพร่ทันที"}
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
