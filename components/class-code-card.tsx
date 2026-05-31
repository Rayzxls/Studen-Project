"use client";

import { QRCodeSVG } from "qrcode.react";
import { CopyButton } from "./copy-button";

interface ClassCodeCardProps {
  classCode: string;
  courseName: string;
  className: string;
  appUrl?: string;
}

export function ClassCodeCard({
  classCode,
  courseName,
  className,
  appUrl = typeof window !== "undefined" ? window.location.origin : "",
}: ClassCodeCardProps) {
  const inviteUrl = `${appUrl}/join?code=${encodeURIComponent(classCode)}`;

  return (
    <div className="card sheen p-6">
      <div className="mb-4">
        <h2 className="font-semibold tracking-tight">เชิญนักเรียนเข้าห้อง</h2>
        <p className="mt-0.5 text-xs text-ink-soft">
          ให้นักเรียนใช้รหัส, สแกน QR, หรือกดลิงก์
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-4">
          <QRCodeSVG
            value={inviteUrl}
            size={180}
            level="M"
            includeMargin={false}
            fgColor="#0F172A"
            bgColor="#FFFFFF"
          />
          <p className="mt-3 text-center text-xs text-ink-soft">
            สแกนด้วยมือถือเพื่อเข้าห้อง
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-ink-soft">
              รหัสห้องเรียน
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-lg font-bold tracking-wider text-ink">
                {classCode}
              </code>
              <CopyButton text={classCode} />
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-ink-soft">
              ลิงก์เชิญ
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-ink">
                {inviteUrl}
              </code>
              <CopyButton text={inviteUrl} />
            </div>
          </div>

          <div className="rounded-lg bg-accent-soft p-3 text-xs">
            <div className="font-semibold text-amber-800">{courseName}</div>
            <div className="text-amber-700">ห้อง {className}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
