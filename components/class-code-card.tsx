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
    <div className="card p-6">
      <div className="mb-4">
        <h2
          className="text-lg font-medium text-black"
          style={{ letterSpacing: "-0.02em" }}
        >
          เชิญนักเรียนเข้าห้อง
        </h2>
        <p className="mt-1 text-xs text-black/60">
          ให้นักเรียนใช้รหัส, สแกน QR, หรือกดลิงก์
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-4 ring-1 ring-black/[0.06]">
          <QRCodeSVG
            value={inviteUrl}
            size={180}
            level="M"
            includeMargin={false}
            fgColor="#000000"
            bgColor="#FFFFFF"
          />
          <p className="mt-3 text-center text-xs text-black/60">
            สแกนด้วยมือถือเพื่อเข้าห้อง
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1.5 text-xs font-medium text-black/60">
              รหัสห้องเรียน
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-xl bg-black/[0.04] px-3 py-2 font-mono text-lg font-medium tracking-wider text-black">
                {classCode}
              </code>
              <CopyButton text={classCode} />
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-black/60">
              ลิงก์เชิญ
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-xl bg-black/[0.04] px-3 py-2 font-mono text-xs text-black">
                {inviteUrl}
              </code>
              <CopyButton text={inviteUrl} />
            </div>
          </div>

          <div className="rounded-xl bg-black/[0.04] p-3 text-xs">
            <div className="font-medium text-black">{courseName}</div>
            <div className="text-black/60">ห้อง {className}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
