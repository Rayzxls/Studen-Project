"use client";

import { Clock3, KeyRound, Link2, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { CopyButton } from "./copy-button";

interface ClassCodeCardProps {
  classCode: string;
  courseName: string;
  className: string;
  appUrl: string;
  canJoin: boolean;
  inviteStatus: "READY" | "DISABLED" | "EXPIRED";
  codeExpiresAtLabel: string | null;
}

export function ClassCodeCard({
  classCode,
  courseName,
  className,
  appUrl,
  canJoin,
  inviteStatus,
  codeExpiresAtLabel,
}: ClassCodeCardProps) {
  const inviteUrl = `${appUrl.replace(/\/$/, "")}/join?code=${encodeURIComponent(classCode)}`;

  return (
    <section
      className="card-flat p-5 sm:p-6"
      aria-labelledby="class-invite-title"
      data-testid="class-invite-card"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <QrCode className="h-5 w-5" />
          </div>
          <div>
            <h2
              id="class-invite-title"
              className="text-lg font-semibold text-black"
            >
              เชิญนักเรียนเข้าห้อง
            </h2>
            <p className="mt-1 text-sm text-black/60">
              แชร์รหัส ลิงก์ หรือให้นักเรียนสแกน QR จากโทรศัพท์
            </p>
          </div>
        </div>
        <span className={canJoin ? "badge badge-success" : "badge"}>
          {inviteStatus === "READY"
            ? "พร้อมเข้าร่วม"
            : inviteStatus === "EXPIRED"
              ? "รหัสหมดอายุ"
              : "ปิดรับสมาชิก"}
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-5 ring-1 ring-black/[0.06]">
          <QRCodeSVG
            value={inviteUrl}
            size={180}
            level="M"
            includeMargin={false}
            fgColor="#111827"
            bgColor="#FFFFFF"
            title={`QR เข้าร่วมห้อง ${courseName}`}
            data-testid="class-invite-qr"
          />
          <p className="mt-3 text-center text-xs text-black/60">
            สแกนแล้วเปิดหน้ารหัสที่กรอกไว้ให้ทันที
          </p>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="rounded-2xl bg-black/[0.03] p-4 ring-1 ring-black/[0.06]">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-black/60">
              <KeyRound className="h-4 w-4" />
              รหัสห้องเรียน
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <code
                className="min-w-0 flex-1 break-all rounded-xl bg-white px-3 py-2 font-mono text-lg font-semibold tracking-wider text-black ring-1 ring-black/[0.06]"
                data-testid="class-invite-code"
              >
                {classCode}
              </code>
              <CopyButton text={classCode} />
            </div>
          </div>

          <div className="rounded-2xl bg-black/[0.03] p-4 ring-1 ring-black/[0.06]">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-black/60">
              <Link2 className="h-4 w-4" />
              ลิงก์เชิญ
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <code
                className="min-w-0 flex-1 break-all rounded-xl bg-white px-3 py-2 font-mono text-xs text-black ring-1 ring-black/[0.06]"
                data-testid="class-invite-url"
              >
                {inviteUrl}
              </code>
              <CopyButton text={inviteUrl} />
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl bg-blue-50 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="font-semibold text-black">{courseName}</div>
              <div className="mt-0.5 text-black/60">ห้อง {className}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs text-black/60">
              <Clock3 className="h-4 w-4" />
              {codeExpiresAtLabel
                ? `ใช้ได้ถึง ${codeExpiresAtLabel}`
                : "ไม่มีวันหมดอายุ"}
            </div>
          </div>

          {!canJoin && (
            <p className="rounded-xl bg-orange-50 px-3 py-2 text-xs text-orange-700">
              QR และลิงก์นี้ยังเปิดดูได้
              แต่ระบบจะไม่รับสมาชิกจนกว่าจะเปิดรหัสหรือตั้งวันหมดอายุใหม่
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
