"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  ImageIcon,
  X,
} from "lucide-react";

export type AssignmentAttachmentFile = {
  id: string;
  originalFilename: string;
  sizeBytes: number;
  mimeType: string;
};

export function AssignmentAttachmentGallery({
  files,
}: {
  files: AssignmentAttachmentFile[];
}) {
  const images = useMemo(
    () => files.filter((file) => file.mimeType.startsWith("image/")),
    [files]
  );
  const documents = useMemo(
    () => files.filter((file) => !file.mimeType.startsWith("image/")),
    [files]
  );
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (files.length === 0) return null;

  return (
    <section className="mt-6 rounded-[24px] border border-black/[0.06] bg-black/[0.025] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-black">
            <ImageIcon className="h-4 w-4 text-blue-500" aria-hidden="true" />
            รูปและไฟล์ประกอบงาน
          </p>
          <p className="mt-1 text-xs text-black/50">
            {images.length > 0 ? `${images.length} รูป` : "ไม่มีรูป"}
            {documents.length > 0 ? ` · ${documents.length} ไฟล์` : ""}
          </p>
        </div>
      </div>

      {images.length > 0 && (
        <div
          className={
            "mt-4 grid gap-3 " +
            (images.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")
          }
        >
          {images.map((file, index) => (
            <button
              key={file.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className="group relative flex min-h-[260px] items-center justify-center overflow-hidden rounded-2xl border border-black/[0.06] bg-black/[0.04] text-left transition hover:border-blue-500/35 sm:min-h-[360px]"
              aria-label={`เปิดรูป ${file.originalFilename}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fileHref(file.id)}
                alt={file.originalFilename}
                className="max-h-[520px] w-full object-contain transition-transform duration-300 group-hover:scale-[1.01]"
              />
              <span className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3 rounded-2xl bg-black/55 px-3 py-2 text-xs text-white backdrop-blur">
                <span className="min-w-0 truncate font-medium">
                  {file.originalFilename}
                </span>
                <span className="shrink-0 text-white/75">
                  {formatBytes(file.sizeBytes)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {documents.length > 0 && (
        <div className="mt-3 grid gap-2">
          {documents.map((file) => (
            <a
              key={file.id}
              href={fileHref(file.id)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white px-3 py-3 text-sm transition hover:border-blue-500/25 hover:bg-blue-50 hover:no-underline"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <FileText className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-black">
                  {file.originalFilename}
                </span>
                <span className="block text-xs text-black/45">
                  {formatBytes(file.sizeBytes)}
                </span>
              </span>
              <ExternalLink className="h-4 w-4 shrink-0 text-black/35" />
            </a>
          ))}
        </div>
      )}

      {activeIndex !== null && (
        <ImagePreviewDialog
          images={images}
          activeIndex={activeIndex}
          onChange={setActiveIndex}
          onClose={() => setActiveIndex(null)}
        />
      )}
    </section>
  );
}

function ImagePreviewDialog({
  images,
  activeIndex,
  onChange,
  onClose,
}: {
  images: AssignmentAttachmentFile[];
  activeIndex: number;
  onChange: (nextIndex: number) => void;
  onClose: () => void;
}) {
  const active = images[activeIndex];
  const canMove = images.length > 1;

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && canMove) {
        onChange((activeIndex - 1 + images.length) % images.length);
      }
      if (event.key === "ArrowRight" && canMove) {
        onChange((activeIndex + 1) % images.length);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeIndex, canMove, images.length, onChange, onClose]);

  if (!active) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`ดูรูป ${active.originalFilename}`}
      onClick={onClose}
    >
      <div
        className="relative flex h-[calc(100vh-2rem)] w-full items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute left-0 top-0 z-10 flex max-w-[calc(100%-4rem)] items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-medium text-white backdrop-blur">
          <span className="truncate">{active.originalFilename}</span>
          <a
            href={fileHref(active.id)}
            download={active.originalFilename}
            className="inline-flex shrink-0 items-center gap-1 text-white/75 hover:text-white hover:no-underline"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            ดาวน์โหลด
          </a>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute right-0 top-0 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur transition hover:bg-white/20"
          aria-label="ปิดรูปภาพ"
        >
          <X className="h-5 w-5" />
        </button>

        {canMove && (
          <button
            type="button"
            onClick={() =>
              onChange((activeIndex - 1 + images.length) % images.length)
            }
            className="absolute left-0 z-10 inline-flex h-11 w-11 -translate-x-2 items-center justify-center rounded-full bg-white/14 text-white backdrop-blur transition hover:bg-white/24 sm:-translate-x-16"
            aria-label="รูปก่อนหน้า"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fileHref(active.id)}
          alt={active.originalFilename}
          className="max-h-full max-w-full object-contain shadow-2xl"
        />

        {canMove && (
          <button
            type="button"
            onClick={() => onChange((activeIndex + 1) % images.length)}
            className="absolute right-0 z-10 inline-flex h-11 w-11 translate-x-2 items-center justify-center rounded-full bg-white/14 text-white backdrop-blur transition hover:bg-white/24 sm:translate-x-16"
            aria-label="รูปถัดไป"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        {canMove && (
          <span className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/12 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            {activeIndex + 1} / {images.length}
          </span>
        )}
      </div>
    </div>,
    document.body
  );
}

function fileHref(fileId: string): string {
  return `/api/storage/files/${fileId}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
