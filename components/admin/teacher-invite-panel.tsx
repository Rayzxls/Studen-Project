"use client";

import { useActionState, useState } from "react";
import { FileSpreadsheet, Mail, Upload } from "lucide-react";

import {
  issueBulkInvitesAction,
  issueInviteAction,
  revokeInviteAction,
  type BulkInviteState,
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
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [state, formAction, pending] = useActionState<InviteState, FormData>(
    issueInviteAction,
    {}
  );
  const [bulkState, bulkFormAction, bulkPending] = useActionState<
    BulkInviteState,
    FormData
  >(issueBulkInvitesAction, {});

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h2 className="text-base font-semibold">เพิ่มครูเข้าสู่ระบบ</h2>
        <p className="mt-1 text-xs text-black/50">
          สร้างคำเชิญที่ผูกกับอีเมล ครูจะยืนยันตัวตนและรับบัญชีด้วย Google
          ด้วยตนเอง คำเชิญหมดอายุใน 7 วัน
        </p>

        <div className="mt-5 inline-flex rounded-lg bg-black/[0.04] p-1">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors ${
              mode === "single"
                ? "bg-white text-black shadow-sm"
                : "text-black/55 hover:text-black"
            }`}
          >
            <Mail className="h-4 w-4" />
            รายคน
          </button>
          <button
            type="button"
            onClick={() => setMode("bulk")}
            className={`inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors ${
              mode === "bulk"
                ? "bg-white text-black shadow-sm"
                : "text-black/55 hover:text-black"
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            หลายคนด้วย CSV
          </button>
        </div>

        {mode === "single" ? (
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
        ) : (
          <form action={bulkFormAction} className="mt-4 space-y-3">
            <label
              htmlFor="invite-csv"
              className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-black/15 bg-black/[0.015] px-4 text-center transition-colors hover:border-blue-300 hover:bg-blue-50/40"
            >
              <Upload className="h-5 w-5 text-blue-600" />
              <span className="mt-2 text-sm font-medium text-black/75">
                เลือกไฟล์รายชื่อครู
              </span>
              <span className="mt-1 text-xs text-black/45">
                CSV ที่มีคอลัมน์ email รองรับครั้งละไม่เกิน 500 อีเมล
              </span>
              <input
                id="invite-csv"
                name="file"
                type="file"
                accept=".csv,text/csv"
                required
                className="sr-only"
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <a
                href="data:text/csv;charset=utf-8,email%0Ateacher.one%40example.com%0Ateacher.two%40example.com"
                download="teacher-invites-template.csv"
                className="text-xs font-medium text-blue-700 hover:underline"
              >
                ดาวน์โหลดไฟล์ตัวอย่าง
              </a>
              <button
                type="submit"
                className="btn-primary btn-sm"
                disabled={bulkPending}
              >
                {bulkPending ? "กำลังสร้างคำเชิญ…" : "นำเข้าและสร้างคำเชิญ"}
              </button>
            </div>
          </form>
        )}

        {mode === "single" && state.error && (
          <ErrorMessage message={state.error} />
        )}
        {mode === "single" && state.issued && (
          <IssuedInvite
            email={state.issued.email}
            rawToken={state.issued.rawToken}
            replaced={state.issued.replaced}
            expiresAt={fmt(state.issued.expiresAt)}
          />
        )}
        {mode === "bulk" && bulkState.error && (
          <ErrorMessage message={bulkState.error} detail={bulkState.detail} />
        )}
        {mode === "bulk" && bulkState.result && (
          <BulkInviteResult result={bulkState.result} formatDate={fmt} />
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

function ErrorMessage({
  message,
  detail,
}: {
  message: string;
  detail?: string;
}) {
  return (
    <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      <p>{message}</p>
      {detail && <p className="mt-0.5 text-xs text-red-700/75">{detail}</p>}
    </div>
  );
}

function BulkInviteResult({
  result,
  formatDate,
}: {
  result: NonNullable<BulkInviteState["result"]>;
  formatDate: (iso: string) => string;
}) {
  return (
    <div className="mt-4 space-y-3">
      {result.issued.length > 0 && (
        <div>
          <p className="text-sm font-medium text-green-800">
            สร้างคำเชิญสำเร็จ {result.issued.length.toLocaleString("th-TH")}{" "}
            รายการ
          </p>
          <div className="mt-2 max-h-80 space-y-2 overflow-y-auto pr-1">
            {result.issued.map((invite) => (
              <IssuedInvite
                key={invite.email}
                email={invite.email}
                rawToken={invite.rawToken}
                replaced={invite.replaced}
                expiresAt={formatDate(invite.expiresAt)}
                compact
              />
            ))}
          </div>
        </div>
      )}
      {result.failed.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm font-medium text-orange-900">
            ไม่ได้สร้าง {result.failed.length.toLocaleString("th-TH")} รายการ
          </p>
          <ul className="mt-2 space-y-1 text-xs text-orange-800">
            {result.failed.map((failure) => (
              <li key={failure.email}>
                {failure.email}: {failure.error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function IssuedInvite({
  email,
  rawToken,
  replaced,
  expiresAt,
  compact = false,
}: {
  email: string;
  rawToken: string;
  replaced: number;
  expiresAt: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  // The origin is only known in the browser; this block renders after the
  // client action returns, so `window` is always present here.
  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/invite/${rawToken}`
      : `/invite/${rawToken}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className={`${compact ? "" : "mt-4"} rounded-xl border border-green-200 bg-green-50 p-4`}
    >
      <p className="text-sm font-medium text-green-800">
        สร้างคำเชิญให้ {email} แล้ว
        {replaced > 0 && ` (แทนที่คำเชิญเดิม ${replaced} รายการ)`}
      </p>
      {!compact && (
        <p className="mt-2 text-xs text-black/60">
          ส่งลิงก์นี้ให้ครู — ครูเปิดลิงก์แล้วเข้าสู่ระบบด้วย Google
          เพื่อรับบัญชี จะแสดงเพียงครั้งเดียวและหมดอายุ {expiresAt}
        </p>
      )}
      <div className="mt-2 flex items-stretch gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-white px-3 py-2 font-mono text-xs text-black">
          {link}
        </code>
        <button
          type="button"
          onClick={copy}
          className="btn-secondary btn-sm shrink-0"
        >
          {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
        </button>
      </div>
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
