"use client";

import type { ModerationTargetType } from "@prisma/client";
import { Flag, X } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import {
  reportContentAction,
  type ReportContentActionState,
} from "@/app/moderation/actions";

const INITIAL_STATE: ReportContentActionState = {};

export function ReportContentButton({
  targetType,
  targetId,
  compact = false,
}: {
  targetType: ModerationTargetType;
  targetId: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    reportContentAction,
    INITIAL_STATE
  );

  useEffect(() => {
    if (!state.ok) return;
    const timer = window.setTimeout(() => setOpen(false), 900);
    return () => window.clearTimeout(timer);
  }, [state.ok]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? "icon-button h-8 w-8 text-ink-soft"
            : "btn-ghost btn-sm gap-1.5 text-ink-soft"
        }
        aria-label="รายงานเนื้อหา"
        title="รายงานเนื้อหา"
      >
        <Flag className="h-4 w-4" />
        {!compact && <span>รายงาน</span>}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/45 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-content-title"
            className="card w-full max-w-lg p-5 shadow-lift sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="report-content-title"
                  className="text-lg font-semibold text-black"
                >
                  รายงานเนื้อหา
                </h2>
                <p className="mt-1 text-sm text-ink-soft">
                  รายงานจะถูกส่งให้ผู้ดูแลตรวจสอบ
                  และจะไม่ซ่อนเนื้อหาโดยอัตโนมัติ
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="icon-button h-9 w-9"
                aria-label="ปิด"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={action} className="mt-5 space-y-4">
              <input type="hidden" name="targetType" value={targetType} />
              <input type="hidden" name="targetId" value={targetId} />

              <label className="block text-sm font-medium text-black">
                ประเภทปัญหา
                <select
                  name="category"
                  defaultValue=""
                  className="input mt-1.5"
                  required
                >
                  <option value="" disabled>
                    เลือกประเภท
                  </option>
                  <option value="HARASSMENT">การคุกคามหรือกลั่นแกล้ง</option>
                  <option value="INAPPROPRIATE_CONTENT">
                    เนื้อหาไม่เหมาะสม
                  </option>
                  <option value="PRIVACY">
                    ข้อมูลส่วนตัวหรือความเป็นส่วนตัว
                  </option>
                  <option value="COPYRIGHT">ลิขสิทธิ์</option>
                  <option value="SPAM">สแปมหรือเนื้อหาหลอกลวง</option>
                  <option value="OTHER">อื่น ๆ</option>
                </select>
                {state.fieldErrors?.category && (
                  <span className="mt-1 block text-xs text-red-600">
                    กรุณาเลือกประเภทปัญหา
                  </span>
                )}
              </label>

              <label className="block text-sm font-medium text-black">
                รายละเอียด
                <textarea
                  name="details"
                  className="input mt-1.5 min-h-28 resize-y text-sm"
                  placeholder="อธิบายสิ่งที่พบอย่างน้อย 5 ตัวอักษร"
                  minLength={5}
                  maxLength={1000}
                  required
                />
                {state.fieldErrors?.details && (
                  <span className="mt-1 block text-xs text-red-600">
                    กรุณาระบุรายละเอียด 5-1,000 ตัวอักษร
                  </span>
                )}
              </label>

              {state.ok && (
                <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
                  {state.duplicate
                    ? "คุณเคยรายงานรายการนี้แล้ว ระบบไม่เพิ่มรายงานซ้ำ"
                    : "ส่งรายงานให้ผู้ดูแลแล้ว"}
                </div>
              )}
              {state.error && !state.ok && !state.fieldErrors && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  ไม่สามารถส่งรายงานได้ กรุณาลองใหม่อีกครั้ง
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-secondary btn-sm"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="btn-primary btn-sm"
                >
                  {pending ? "กำลังส่ง..." : "ส่งรายงาน"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
