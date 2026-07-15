"use client";

import type {
  ModerationCaseStatus,
  ModerationRestrictionKind,
  ModerationTargetType,
} from "@prisma/client";
import { ShieldCheck } from "lucide-react";
import { useActionState } from "react";
import {
  moderationCaseAction,
  type ModerationActionState,
} from "@/app/admin/moderation/actions";

const INITIAL_STATE: ModerationActionState = {};

export function ModerationCaseActions({
  caseId,
  status,
  targetType,
  restrictionKind,
}: {
  caseId: string;
  status: ModerationCaseStatus;
  targetType: ModerationTargetType;
  restrictionKind: ModerationRestrictionKind | null;
}) {
  const [state, action, pending] = useActionState(
    moderationCaseAction,
    INITIAL_STATE
  );
  const reviewable = status === "OPEN" || status === "APPEALED";
  const closed = status === "RESOLVED" || status === "DISMISSED";
  const fileTarget =
    targetType === "FILE_ATTACHMENT" || targetType === "PROFILE_IMAGE";

  if (closed) {
    return (
      <div className="panel-inset p-4 text-sm text-ink-soft">
        Case นี้ปิดการตรวจสอบแล้ว ประวัติการตัดสินยังคงอยู่ใน Audit Log
      </div>
    );
  }

  return (
    <form action={action} className="card space-y-4 p-5">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-700">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-black">ดำเนินการ Case</h2>
          <p className="text-xs text-ink-soft">
            ทุกการเปลี่ยนแปลงต้องมีเหตุผลและถูกบันทึก Audit
          </p>
        </div>
      </div>

      <input type="hidden" name="caseId" value={caseId} />

      <label className="block text-sm font-medium text-black">
        การดำเนินการ
        <select
          name="action"
          defaultValue={reviewable ? "START_REVIEW" : ""}
          className="input mt-1.5"
          required
        >
          {!reviewable && <option value="">เลือกการดำเนินการ</option>}
          {reviewable ? (
            <option value="START_REVIEW">รับ Case เข้าตรวจสอบ</option>
          ) : (
            <>
              {!restrictionKind && (
                <option value={fileTarget ? "QUARANTINE" : "HIDE"}>
                  {fileTarget ? "กักไฟล์ชั่วคราว" : "ซ่อนเนื้อหาชั่วคราว"}
                </option>
              )}
              {restrictionKind && (
                <option value="RESTORE">คืนค่าการแสดงผล</option>
              )}
              <option value="RESOLVE">ยืนยันว่ามีปัญหาและปิด Case</option>
              <option value="DISMISS">ไม่พบการละเมิดและยกคำร้อง</option>
            </>
          )}
        </select>
      </label>

      <label className="block text-sm font-medium text-black">
        เหตุผลภายในสำหรับ Admin
        <textarea
          name="internalReason"
          className="input mt-1.5 min-h-24 resize-y text-sm"
          minLength={5}
          maxLength={1000}
          placeholder="บันทึกสิ่งที่ตรวจพบและเหตุผลในการตัดสิน"
          required
        />
        {state.fieldErrors?.internalReason && (
          <span className="mt-1 block text-xs text-red-600">
            กรุณาระบุเหตุผล 5-1,000 ตัวอักษร
          </span>
        )}
      </label>

      <label className="block text-sm font-medium text-black">
        ข้อความแจ้งเจ้าของเนื้อหา (ไม่บังคับ)
        <textarea
          name="userMessage"
          className="input mt-1.5 min-h-20 resize-y text-sm"
          maxLength={500}
          placeholder="อธิบายผลโดยไม่เปิดเผยตัวผู้รายงาน"
        />
      </label>

      <label className="panel-inset flex cursor-pointer items-start gap-2 p-3 text-sm text-black">
        <input
          type="checkbox"
          name="confirmed"
          value="yes"
          className="mt-0.5 h-4 w-4"
          required
        />
        <span>ยืนยันว่าตรวจสอบหลักฐานและเข้าใจผลของการดำเนินการแล้ว</span>
      </label>

      {state.error && !state.fieldErrors && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          ไม่สามารถดำเนินการได้ ({state.error})
        </div>
      )}
      {state.ok && (
        <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
          บันทึกการดำเนินการเรียบร้อยแล้ว
        </div>
      )}

      <button type="submit" disabled={pending} className="btn-primary btn-sm">
        {pending ? "กำลังบันทึก..." : "ยืนยันการดำเนินการ"}
      </button>
    </form>
  );
}
