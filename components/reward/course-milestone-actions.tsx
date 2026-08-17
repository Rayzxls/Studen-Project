"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Archive, Check, Gift, Pencil, Plus, X } from "lucide-react";

import {
  archiveCourseRewardTierAction,
  createCourseRewardTierAction,
  resolveCourseRewardClaimAction,
  updateCourseRewardTierAction,
  type CourseRewardActionState,
} from "@/app/teacher/courses/[id]/rewards/actions";
import {
  claimCourseRewardAction,
  type ClaimCourseRewardState,
} from "@/app/student/courses/[id]/rewards/actions";
import type { CourseRewardTierView } from "@/lib/reward/course-milestones";

const INITIAL_STATE: CourseRewardActionState = {};
const INITIAL_CLAIM_STATE: ClaimCourseRewardState = {};

function fieldMessage(code: string | undefined) {
  const messages: Record<string, string> = {
    title_required: "กรุณาใส่ชื่อรางวัล",
    title_too_long: "ชื่อรางวัลยาวเกินไป",
    description_too_long: "รายละเอียดต้องไม่เกิน 1,000 ตัวอักษร",
    fulfillment_instructions_too_long:
      "วิธีรับรางวัลต้องไม่เกิน 1,000 ตัวอักษร",
    required_score_invalid: "เกณฑ์ต้องเป็นจำนวนเต็มตั้งแต่ 0–100",
  };
  return code ? (messages[code] ?? code) : undefined;
}

export function CourseRewardTierForm({
  courseId,
  tier,
}: {
  courseId: string;
  tier?: CourseRewardTierView;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    tier ? updateCourseRewardTierAction : createCourseRewardTierAction,
    INITIAL_STATE
  );

  useEffect(() => {
    if (state.ok && !tier) formRef.current?.reset();
  }, [state.ok, tier]);

  const form = (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      {tier && <input type="hidden" name="tierId" value={tier.id} />}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-black/60">
            ชื่อรางวัล
          </span>
          <input
            className="input"
            name="title"
            required
            maxLength={120}
            defaultValue={tier?.title}
            placeholder="เช่น ใบประกาศนักเรียนดาวเด่น"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-black/60">
            คะแนนถึง (%)
          </span>
          <input
            className="input tabular-nums"
            name="requiredScore"
            type="number"
            min={0}
            max={100}
            step={1}
            required
            defaultValue={tier?.requiredScore}
            placeholder="80"
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-black/60">
          รายละเอียด
        </span>
        <textarea
          className="input min-h-20 resize-y"
          name="description"
          maxLength={1000}
          defaultValue={tier?.description ?? ""}
          placeholder="นักเรียนจะได้รับอะไร และรางวัลนี้มีความหมายอย่างไร"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-black/60">
          วิธีรับรางวัล
        </span>
        <textarea
          className="input min-h-20 resize-y"
          name="fulfillmentInstructions"
          maxLength={1000}
          defaultValue={tier?.fulfillmentInstructions ?? ""}
          placeholder="เช่น ติดต่อครูหลังคาบเรียน หรือแสดงสถานะคำขอนี้"
        />
      </label>
      {fieldMessage(state.fieldErrors?.reward) && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
          {fieldMessage(state.fieldErrors?.reward)}
        </p>
      )}
      {state.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.error}
        </p>
      )}
      {state.ok && tier && (
        <p className="rounded-xl bg-green-50 px-3 py-2 text-xs text-green-700">
          บันทึกการแก้ไขแล้ว
        </p>
      )}
      <div className="flex justify-end">
        <SubmitButton
          icon={tier ? Pencil : Plus}
          label={tier ? "บันทึกการแก้ไข" : "เพิ่มรางวัล"}
          pendingLabel="กำลังบันทึก…"
        />
      </div>
    </form>
  );

  if (!tier) return form;
  return (
    <details className="group w-full">
      <summary className="btn-secondary btn-sm inline-flex cursor-pointer list-none items-center gap-1.5">
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        แก้ไข
      </summary>
      <div className="mt-4 border-t border-black/[0.06] pt-4">{form}</div>
    </details>
  );
}

export function ArchiveCourseRewardTierButton({
  courseId,
  tier,
}: {
  courseId: string;
  tier: CourseRewardTierView;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction] = useActionState(
    archiveCourseRewardTierAction,
    INITIAL_STATE
  );

  return (
    <>
      <button
        type="button"
        className="btn-ghost btn-sm text-red-700 hover:bg-red-50"
        onClick={() => dialogRef.current?.showModal()}
      >
        <Archive className="h-3.5 w-3.5" aria-hidden="true" />
        เก็บถาวร
      </button>
      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 shadow-lift backdrop:bg-black/40 backdrop:backdrop-blur-sm"
      >
        <form action={formAction} className="p-6">
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name="tierId" value={tier.id} />
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-black">
                เก็บรางวัลนี้ถาวร?
              </h3>
              <p className="mt-1 text-sm text-black/60">
                “{tier.title}” จะไม่เปิดรับคำขอใหม่ แต่คำขอและประวัติเดิมยังอยู่
              </p>
            </div>
            <button
              type="button"
              aria-label="ปิด"
              className="rounded-full p-1 text-black/40 hover:bg-black/[0.05] hover:text-black"
              onClick={() => dialogRef.current?.close()}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {state.error && (
            <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
              {state.error}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => dialogRef.current?.close()}
            >
              ยกเลิก
            </button>
            <SubmitButton
              icon={Archive}
              label="ยืนยันเก็บถาวร"
              pendingLabel="กำลังเก็บ…"
              danger
            />
          </div>
        </form>
      </dialog>
    </>
  );
}

export function ClaimCourseRewardButton({
  courseId,
  enrollmentId,
}: {
  courseId: string;
  enrollmentId: string;
}) {
  const [state, formAction] = useActionState(
    claimCourseRewardAction,
    INITIAL_CLAIM_STATE
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <SubmitButton
        icon={Gift}
        label="ส่งคำขอรับรางวัล"
        pendingLabel="กำลังส่งคำขอ…"
      />
      {state.error && (
        <p className="mt-2 text-xs text-red-700">{state.error}</p>
      )}
    </form>
  );
}

export function ResolveCourseRewardClaim({
  courseId,
  claimId,
}: {
  courseId: string;
  claimId: string;
}) {
  const [state, formAction] = useActionState(
    resolveCourseRewardClaimAction,
    INITIAL_STATE
  );
  return (
    <div className="space-y-2">
      <form action={formAction} className="flex justify-end">
        <input type="hidden" name="courseId" value={courseId} />
        <input type="hidden" name="claimId" value={claimId} />
        <input type="hidden" name="outcome" value="FULFILLED" />
        <SubmitButton
          icon={Check}
          label="ส่งมอบแล้ว"
          pendingLabel="กำลังบันทึก…"
        />
      </form>
      <details className="group text-right">
        <summary className="inline-flex cursor-pointer list-none text-xs font-medium text-red-700 hover:underline">
          ปฏิเสธคำขอ
        </summary>
        <form action={formAction} className="mt-2 space-y-2 text-left">
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name="claimId" value={claimId} />
          <input type="hidden" name="outcome" value="REJECTED" />
          <label className="block">
            <span className="mb-1 block text-xs text-black/60">
              เหตุผลที่แจ้งนักเรียน
            </span>
            <textarea
              className="input min-h-20 resize-y"
              name="reason"
              required
              minLength={5}
              maxLength={500}
              placeholder="อย่างน้อย 5 ตัวอักษร"
            />
          </label>
          <div className="flex justify-end">
            <SubmitButton
              icon={X}
              label="ยืนยันปฏิเสธ"
              pendingLabel="กำลังบันทึก…"
              danger
            />
          </div>
        </form>
      </details>
      {state.error && <p className="text-xs text-red-700">{state.error}</p>}
    </div>
  );
}

function SubmitButton({
  icon: Icon,
  label,
  pendingLabel,
  danger = false,
}: {
  icon: typeof Plus;
  label: string;
  pendingLabel: string;
  danger?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${danger ? "btn-danger" : "btn-primary"} btn-sm inline-flex cursor-pointer items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {pending ? pendingLabel : label}
    </button>
  );
}
