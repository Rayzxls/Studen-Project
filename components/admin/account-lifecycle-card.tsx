"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import {
  changeAccountStatusAction,
  type AccountLifecycleActionState,
} from "@/app/admin/users/[id]/actions";

const INITIAL_STATE: AccountLifecycleActionState = {};

type ManageableAccountStatus = "ACTIVE" | "SUSPENDED";

export function AccountLifecycleCard({
  userId,
  displayName,
  status,
}: {
  userId: string;
  displayName: string;
  status: ManageableAccountStatus;
}) {
  const [state, action] = useActionState(
    changeAccountStatusAction,
    INITIAL_STATE
  );
  const isSuspending = status === "ACTIVE";
  const targetStatus: ManageableAccountStatus = isSuspending
    ? "SUSPENDED"
    : "ACTIVE";

  return (
    <section className="card p-6" aria-labelledby="account-lifecycle-title">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700">
          {isSuspending ? (
            <PauseCircle className="h-5 w-5" />
          ) : (
            <PlayCircle className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0">
          <h2
            id="account-lifecycle-title"
            className="text-sm font-medium text-black"
          >
            {isSuspending ? "ระงับบัญชีชั่วคราว" : "เปิดใช้งานบัญชีอีกครั้ง"}
          </h2>
          <p className="mt-1 text-xs leading-5 text-black/55">
            {isSuspending
              ? `หยุดการเข้าสู่ระบบของ ${displayName} และออกจากระบบทุกอุปกรณ์ทันที โดยไม่ลบงาน คะแนน หรือประวัติการเรียน`
              : `อนุญาตให้ ${displayName} กลับเข้าสู่ระบบได้อีกครั้ง ข้อมูลการเรียนเดิมยังคงอยู่`}
          </p>
        </div>
      </div>

      <form action={action} className="mt-5 space-y-4">
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="to" value={targetStatus} />

        <label className="block">
          <span className="text-xs font-medium text-black/70">
            เหตุผลภายในสำหรับ Admin
          </span>
          <textarea
            name="internalReason"
            required
            minLength={5}
            maxLength={1000}
            rows={3}
            placeholder="ระบุเหตุผลเพื่อบันทึกใน Audit Log"
            className="input mt-1.5 min-h-24 resize-y text-sm"
          />
          {state.fieldErrors?.internalReason && (
            <span className="mt-1 block text-xs text-red-600">
              กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-xs font-medium text-black/70">
            ข้อความแจ้งผู้ใช้
          </span>
          <textarea
            name="userMessage"
            required
            minLength={5}
            maxLength={500}
            rows={3}
            placeholder="อธิบายให้ผู้ใช้เข้าใจว่าเกิดอะไรขึ้นและต้องติดต่อใคร"
            className="input mt-1.5 min-h-24 resize-y text-sm"
          />
          {state.fieldErrors?.userMessage && (
            <span className="mt-1 block text-xs text-red-600">
              กรุณาระบุข้อความอย่างน้อย 5 ตัวอักษร
            </span>
          )}
        </label>

        <label className="panel-inset flex cursor-pointer items-start gap-2 p-3">
          <input
            type="checkbox"
            name="confirmed"
            value="yes"
            required
            className="mt-0.5 h-4 w-4 accent-blue-600"
          />
          <span className="text-xs leading-5 text-black/65">
            {isSuspending
              ? "ฉันตรวจสอบผู้ใช้และเหตุผลแล้ว และเข้าใจว่าผู้ใช้นี้จะถูกออกจากระบบทันที"
              : "ฉันตรวจสอบแล้วว่าผู้ใช้นี้ควรกลับมาเข้าสู่ระบบได้"}
          </span>
        </label>

        {state.error && !state.ok && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{translateLifecycleError(state.error)}</span>
          </div>
        )}

        {state.ok && (
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
            <CheckCircle2 className="h-4 w-4" />
            บันทึกสถานะบัญชีเรียบร้อยแล้ว
          </div>
        )}

        <SubmitButton isSuspending={isSuspending} />
      </form>
    </section>
  );
}

function SubmitButton({ isSuspending }: { isSuspending: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className="btn-primary btn-sm">
      {isSuspending ? (
        <PauseCircle className="h-4 w-4" />
      ) : (
        <PlayCircle className="h-4 w-4" />
      )}
      {pending
        ? "กำลังบันทึก..."
        : isSuspending
          ? "ยืนยันการระงับบัญชี"
          : "ยืนยันการเปิดใช้งาน"}
    </button>
  );
}

function translateLifecycleError(code: string): string {
  switch (code) {
    case "account_lifecycle_mutations_disabled":
      return "ระบบจัดการสถานะบัญชียังไม่เปิดใช้งานในสภาพแวดล้อมนี้";
    case "account_lifecycle_confirmation_required":
      return "กรุณายืนยันว่าคุณตรวจสอบผลกระทบแล้ว";
    case "account_lifecycle_self_action_forbidden":
      return "Admin ไม่สามารถเปลี่ยนสถานะบัญชีของตัวเองจากหน้านี้ได้";
    case "last_active_admin_protected":
      return "ไม่สามารถระงับ Admin คนสุดท้ายที่ยังใช้งานอยู่ได้";
    case "account_lifecycle_state_changed":
      return "สถานะบัญชีถูกเปลี่ยนจากหน้าต่างอื่น กรุณารีเฟรชแล้วลองใหม่";
    case "account_transition_not_allowed":
      return "ไม่สามารถเปลี่ยนสถานะบัญชีตามคำขอนี้ได้";
    case "account_not_found":
      return "ไม่พบบัญชีผู้ใช้นี้";
    default:
      return "บันทึกสถานะไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองใหม่";
  }
}
