"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Paperclip,
  X,
} from "lucide-react";

export type SubmissionPreviewFile = {
  id: string;
  originalFilename: string;
  sizeBytes: number;
  mimeType?: string | null;
};

export function SubmissionFilePreview({
  files,
}: {
  files: SubmissionPreviewFile[];
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeFile = activeIndex === null ? null : (files[activeIndex] ?? null);
  const hasMany = files.length > 1;

  const imageCount = useMemo(
    () => files.filter((file) => isImage(file.mimeType)).length,
    [files]
  );

  const go = useCallback(
    (direction: -1 | 1) => {
      setActiveIndex((current) => {
        if (current === null || files.length === 0) return current;
        return (current + direction + files.length) % files.length;
      });
    },
    [files.length]
  );

  useEffect(() => {
    if (activeIndex === null) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveIndex(null);
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, go]);

  if (files.length === 0) return null;

  return (
    <>
      <ul className="mt-2 flex flex-wrap gap-2">
        {files.map((file, index) => (
          <li key={file.id} className="max-w-full">
            <button
              type="button"
              onClick={() => setActiveIndex(index)}
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 transition hover:border-blue-200 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
              title={file.originalFilename}
            >
              <Paperclip className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="max-w-[180px] truncate">
                {file.originalFilename}
              </span>
              <span className="shrink-0 text-blue-500/70">
                {formatBytes(file.sizeBytes)}
              </span>
              <span className="shrink-0 text-blue-700">เปิดดู</span>
            </button>
          </li>
        ))}
      </ul>

      {activeFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`ดูไฟล์ ${activeFile.originalFilename}`}
        >
          <div
            className="absolute inset-0"
            aria-hidden="true"
            onClick={() => setActiveIndex(null)}
          />

          <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-black">
                  {activeFile.originalFilename}
                </p>
                <p className="text-xs text-black/45">
                  {formatBytes(activeFile.sizeBytes)}
                  {activeFile.mimeType ? ` · ${activeFile.mimeType}` : ""}
                  {hasMany && ` · ${activeIndex! + 1}/${files.length}`}
                  {imageCount > 1 && ` · รูปภาพ ${imageCount} ไฟล์`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <a
                  href={fileUrl(activeFile.id)}
                  download={activeFile.originalFilename}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-black/55 transition hover:bg-black/[0.05] hover:text-black"
                  title="ดาวน์โหลด"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                </a>
                <button
                  type="button"
                  onClick={() => setActiveIndex(null)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-black/55 transition hover:bg-black/[0.05] hover:text-black"
                  aria-label="ปิดพรีวิว"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="relative grid min-h-[55vh] flex-1 place-items-center bg-neutral-950/95 p-3 sm:min-h-[68vh]">
              {hasMany && (
                <>
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    className="absolute left-3 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow-lg transition hover:bg-white"
                    aria-label="ไฟล์ก่อนหน้า"
                  >
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    className="absolute right-3 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow-lg transition hover:bg-white"
                    aria-label="ไฟล์ถัดไป"
                  >
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </>
              )}

              {isImage(activeFile.mimeType) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fileUrl(activeFile.id)}
                  alt={activeFile.originalFilename}
                  className="max-h-[72vh] max-w-full rounded-xl object-contain shadow-2xl"
                />
              ) : isPdf(activeFile.mimeType) ? (
                <iframe
                  src={fileUrl(activeFile.id)}
                  title={activeFile.originalFilename}
                  className="h-[72vh] w-full rounded-xl bg-white"
                />
              ) : (
                <div className="max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
                  <FileText className="mx-auto h-10 w-10 text-black/30" />
                  <p className="mt-3 text-sm font-semibold text-black">
                    ไฟล์นี้ดูตัวอย่างในหน้าเว็บไม่ได้
                  </p>
                  <p className="mt-1 text-xs text-black/50">
                    ดาวน์โหลดไฟล์เพื่อเปิดด้วยโปรแกรมที่รองรับ
                  </p>
                  <a
                    href={fileUrl(activeFile.id)}
                    download={activeFile.originalFilename}
                    className="btn-primary mt-4 inline-flex"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    ดาวน์โหลด
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function fileUrl(fileId: string): string {
  return `/api/storage/files/${fileId}`;
}

function isImage(mimeType?: string | null): boolean {
  return mimeType?.startsWith("image/") ?? false;
}

function isPdf(mimeType?: string | null): boolean {
  return mimeType === "application/pdf";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
