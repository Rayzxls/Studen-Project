"use client";

import { useRef, useState } from "react";
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  Copy,
} from "lucide-react";
import type { PreviewResult, TeacherCsvRow } from "@/lib/admin/csv-import";

type CreatedTeacher = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  tempPassword: string;
};

export function TeacherImportForm() {
  const [stage, setStage] = useState<"upload" | "preview" | "done">("upload");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<{
    message: string;
    detail?: string;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<CreatedTeacher[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError({ message: "กรุณาเลือกไฟล์" });
      return;
    }
    setPending(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/import/teachers/preview", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError({
          message: data.error?.message ?? "อ่านไฟล์ไม่ได้",
          detail: data.error?.detail,
        });
        setPending(false);
        return;
      }
      setPreview(data as PreviewResult);
      setStage("preview");
    } catch {
      setError({ message: "เชื่อมต่อไม่สำเร็จ ลองอีกครั้ง" });
    } finally {
      setPending(false);
    }
  }

  async function handleCommit() {
    if (!preview) return;
    setError(null);
    setPending(true);

    const validRows: TeacherCsvRow[] = preview.rows
      .filter((r) => r.parsed)
      .map((r) => r.parsed!);

    try {
      const res = await fetch("/api/admin/import/teachers/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: validRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError({
          message: data.error?.message ?? "นำเข้าไม่สำเร็จ",
          detail: data.error?.code,
        });
        setPending(false);
        return;
      }
      setCreated(data.created as CreatedTeacher[]);
      setStage("done");
    } catch {
      setError({ message: "เชื่อมต่อไม่สำเร็จ" });
    } finally {
      setPending(false);
    }
  }

  function handleReset() {
    setStage("upload");
    setPreview(null);
    setError(null);
    setCreated([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function copyCredentials() {
    const text = created.map((c) => `${c.email}\t${c.tempPassword}`).join("\n");
    navigator.clipboard.writeText(text);
  }

  function downloadCredentialsCsv() {
    const csv =
      "email,firstName,lastName,tempPassword\n" +
      created
        .map((c) => `${c.email},${c.firstName},${c.lastName},${c.tempPassword}`)
        .join("\n");
    const url = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    const a = document.createElement("a");
    a.href = url;
    a.download = `teachers-credentials-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
  }

  // ───── Stage 3: Done ─────
  if (stage === "done") {
    return (
      <div className="card p-6 border-emerald-300">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          <div>
            <h2 className="font-semibold tracking-tight">นำเข้าสำเร็จ</h2>
            <p className="text-sm text-ink-soft">
              สร้างบัญชีครู {created.length} คน —
              ต้องส่งรหัสผ่านชั่วคราวให้ครูแต่ละคน
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={downloadCredentialsCsv}
            className="btn-primary btn-sm"
          >
            <FileText className="h-4 w-4" />
            ดาวน์โหลดรายชื่อ + รหัสผ่าน (CSV)
          </button>
          <button onClick={copyCredentials} className="btn-secondary btn-sm">
            <Copy className="h-4 w-4" />
            คัดลอกทั้งหมด
          </button>
          <button onClick={handleReset} className="btn-ghost btn-sm">
            นำเข้าเพิ่ม
          </button>
        </div>

        <div className="mt-4 max-h-72 overflow-y-auto rounded-xl border border-black/[0.06]">
          <table className="table">
            <thead>
              <tr>
                <th>อีเมล</th>
                <th>ชื่อ-นามสกุล</th>
                <th>รหัสผ่านชั่วคราว</th>
              </tr>
            </thead>
            <tbody>
              {created.map((c) => (
                <tr key={c.userId}>
                  <td className="text-sm">{c.email}</td>
                  <td className="text-sm">
                    {c.firstName} {c.lastName}
                  </td>
                  <td className="font-mono text-xs">{c.tempPassword}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          ⚠️ เก็บไฟล์รหัสผ่านนี้ไว้ในที่ปลอดภัย —
          ครูจะถูกบังคับให้เปลี่ยนรหัสตอน login ครั้งแรก
        </div>
      </div>
    );
  }

  // ───── Stage 2: Preview ─────
  if (stage === "preview" && preview) {
    const canCommit = preview.summary.valid > 0;
    return (
      <div className="space-y-4">
        <div className="card p-5">
          <h2 className="font-semibold tracking-tight">ตัวอย่างก่อนนำเข้า</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="ทั้งหมด" value={preview.summary.total} />
            <Stat
              label="พร้อมนำเข้า"
              value={preview.summary.valid}
              tone="emerald"
            />
            <Stat
              label="ผิดพลาด"
              value={preview.summary.invalid}
              tone={preview.summary.invalid ? "rose" : undefined}
            />
            <Stat
              label="ซ้ำใน CSV"
              value={preview.summary.duplicateInCsv}
              tone={preview.summary.duplicateInCsv ? "amber" : undefined}
            />
            <Stat
              label="ซ้ำในระบบ"
              value={preview.summary.duplicateInDb}
              tone={preview.summary.duplicateInDb ? "amber" : undefined}
            />
          </div>
        </div>

        <div className="card overflow-hidden p-0">
          <div className="max-h-96 overflow-y-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>แถว</th>
                  <th>อีเมล</th>
                  <th>ชื่อ-นามสกุล</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.row}>
                    <td className="font-mono text-xs">{r.row}</td>
                    <td className="text-sm">{r.raw.email ?? "—"}</td>
                    <td className="text-sm">
                      {r.raw.firstName ?? ""} {r.raw.lastName ?? ""}
                    </td>
                    <td>
                      {r.parsed ? (
                        <span className="badge">พร้อม</span>
                      ) : (
                        <div className="text-xs text-rose-700">
                          <AlertCircle className="inline h-3 w-3 mr-1" />
                          {r.errors?.[0] ?? "ผิดพลาด"}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error.message}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCommit}
            disabled={!canCommit || pending}
            className="btn-primary"
          >
            {pending
              ? "กำลังนำเข้า..."
              : `ยืนยันนำเข้า ${preview.summary.valid} รายการ`}
          </button>
          <button
            onClick={handleReset}
            disabled={pending}
            className="btn-secondary"
          >
            ยกเลิก / อัพโหลดใหม่
          </button>
        </div>
      </div>
    );
  }

  // ───── Stage 1: Upload ─────
  return (
    <form onSubmit={handleUpload} className="card p-6 space-y-4">
      <label
        htmlFor="file"
        className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-black/[0.12] bg-black/[0.02] px-6 py-12 transition-colors hover:border-black hover:bg-black/[0.04]"
      >
        <Upload className="h-10 w-10 text-slate-400" />
        <div className="text-center">
          <div className="font-medium">เลือกไฟล์ CSV</div>
          <div className="mt-0.5 text-xs text-ink-soft">
            ขนาดไม่เกิน 5 MB · ไม่เกิน 5,000 แถว
          </div>
        </div>
        <input
          id="file"
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          required
          className="hidden"
        />
      </label>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <div className="font-medium">{error.message}</div>
          {error.detail && <div className="mt-0.5 text-xs">{error.detail}</div>}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn-primary w-full justify-center"
      >
        {pending ? "กำลังตรวจสอบ..." : "ตรวจสอบไฟล์"}
      </button>
    </form>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "emerald" | "rose" | "amber";
}) {
  const colorClass =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "rose"
        ? "text-rose-700"
        : tone === "amber"
          ? "text-amber-700"
          : "text-ink";
  return (
    <div className="rounded-xl bg-black/[0.04] p-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-ink-soft">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-medium ${colorClass}`}>{value}</div>
    </div>
  );
}
