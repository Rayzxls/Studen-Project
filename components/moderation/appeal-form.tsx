"use client";

import { useActionState } from "react";
import {
  appealModerationAction,
  type AppealModerationActionState,
} from "@/app/moderation/actions";

const INITIAL_STATE: AppealModerationActionState = {};

export function AppealForm({ caseId }: { caseId: string }) {
  const [state, action, pending] = useActionState(
    appealModerationAction,
    INITIAL_STATE
  );

  return (
    <form action={action} className="panel-inset mt-4 space-y-3 p-4">
      <input type="hidden" name="caseId" value={caseId} />
      <label className="block text-sm font-medium text-black">
        เหตุผลที่ขอให้ตรวจสอบอีกครั้ง
        <textarea
          name="reason"
          className="input mt-1.5 min-h-24 resize-y text-sm"
          minLength={5}
          maxLength={1000}
          placeholder="อธิบายข้อมูลที่ควรนำมาพิจารณาเพิ่มเติม"
          required
        />
      </label>
      {state.fieldErrors?.reason && (
        <p className="text-xs text-red-700">กรุณาระบุเหตุผล 5-1,000 ตัวอักษร</p>
      )}
      {state.error && !state.fieldErrors && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          ไม่สามารถยื่นอุทธรณ์ได้ ({state.error})
        </p>
      )}
      {state.ok && (
        <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
          ส่งคำอุทธรณ์ให้ผู้ดูแลตรวจสอบแล้ว
        </p>
      )}
      <button type="submit" className="btn-primary btn-sm" disabled={pending}>
        {pending ? "กำลังส่ง..." : "ยื่นอุทธรณ์"}
      </button>
    </form>
  );
}
