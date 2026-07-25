"use client";

import { useActionState } from "react";

import {
  issueInviteAction,
  revokeInviteAction,
  type InviteState,
} from "@/app/admin/teachers/invites/actions";

export type InviteRow = {
  inviteId: string;
  email: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  expiresAt: string;
  createdAt: string;
};

const STATUS_LABEL: Record<InviteRow["status"], string> = {
  PENDING: "รอตอบรับ",
  ACCEPTED: "ตอบรับแล้ว",
  REVOKED: "ยกเลิกแล้ว",
  EXPIRED: "หมดอายุ",
};

const STATUS_CLASS: Record<InviteRow["status"], string> = {
  PENDING: "bg-blue-50 text-blue-700",
  ACCEPTED: "bg-green-50 text-green-700",
  REVOKED: "bg-red-50 text-red-700",
  EXPIRED: "bg-black/[0.04] text-black/50",
};

export function TeacherInvitePanel({ invites }: { invites: InviteRow[] }) {
  const [state, formAction, pending] = useActionState<InviteState, FormData>(
    issueInviteAction,
    {}
  );

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h2 className="text-base font-semibold">เชิญครูใหม่</h2>
        <p className="mt-1 text-xs text-black/50">
          สร้างคำเชิญผูกกับอีเมล ครูเข้าสู่ระบบด้วย Google เพื่อรับบัญชี
          คำเชิญหมดอายุใน 7 วัน
        </p>

        <form
          action={formAction}
          className="mt-4 flex flex-wrap items-end gap-3"
        >
          <div className="min-w-[16rem] flex-1">
            <label
              htmlFor="invite-email"
              className="block text-xs font-medium text-black/70"
            >
              อีเมลของครู
            </label>
            <input
              id="invite-email"
              name="email"
              type="email"
              required
              autoComplete="off"
              className="input mt-1"
              placeholder="teacher@example.com"
            />
            {state.fieldErrors?.email && (
              <p className="mt-1 text-xs text-red-700">
                {state.fieldErrors.email}
              </p>
            )}
          </div>
          <button
            type="submit"
            className="btn-primary btn-sm"
            disabled={pending}
          >
            {pending ? "กำลังสร้าง…" : "สร้างคำเชิญ"}
          </button>
        </form>

        {state.error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}

        {state.issued && (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-800">
              สร้างคำเชิญให้ {state.issued.email} แล้ว
              {state.issued.replaced > 0 &&
                ` (แทนที่คำเชิญเดิม ${state.issued.replaced} รายการ)`}
            </p>
            <p className="mt-2 text-xs text-black/60">
              คัดลอกโทเคนนี้และส่งให้ครู — จะแสดงเพียงครั้งเดียวและหมดอายุ{" "}
              {fmt(state.issued.expiresAt)}
            </p>
            <code className="mt-2 block overflow-x-auto rounded-lg bg-white px-3 py-2 font-mono text-xs text-black">
              {state.issued.rawToken}
            </code>
          </div>
        )}
      </section>

      <section className="card p-6">
        <h2 className="text-base font-semibold">คำเชิญล่าสุด</h2>
        {invites.length === 0 ? (
          <p className="mt-3 text-sm text-black/50">ยังไม่มีคำเชิญ</p>
        ) : (
          <ul className="mt-4 divide-y divide-black/[0.06]">
            {invites.map((invite) => (
              <li
                key={invite.inviteId}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-black">
                    {invite.email}
                  </div>
                  <div className="text-xs text-black/45">
                    หมดอายุ {fmt(invite.expiresAt)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={
                      "rounded-full px-2.5 py-0.5 text-xs font-medium " +
                      STATUS_CLASS[invite.status]
                    }
                  >
                    {STATUS_LABEL[invite.status]}
                  </span>
                  {invite.status === "PENDING" && (
                    <RevokeInviteForm inviteId={invite.inviteId} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RevokeInviteForm({ inviteId }: { inviteId: string }) {
  const [state, formAction, pending] = useActionState<InviteState, FormData>(
    revokeInviteAction,
    {}
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="inviteId" value={inviteId} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-medium text-red-700 underline-offset-2 hover:underline disabled:opacity-50"
      >
        {pending ? "กำลังยกเลิก…" : "ยกเลิก"}
      </button>
      {state.error && <span className="text-xs text-red-700">!</span>}
    </form>
  );
}
