"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  X,
} from "lucide-react";

export type QuizAttachmentView = {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
};

export function QuizAttachmentPreview({
  attachments,
  compact = false,
}: {
  attachments: QuizAttachmentView[];
  compact?: boolean;
}) {
  const images = useMemo(
    () => attachments.filter((file) => file.mimeType.startsWith("image/")),
    [attachments]
  );
  const documents = useMemo(
    () => attachments.filter((file) => !file.mimeType.startsWith("image/")),
    [attachments]
  );
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (attachments.length === 0) return null;

  return (
    <div className={compact ? "space-y-2" : "mt-4 space-y-3"}>
      {images.length > 0 && (
        <div className="grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-3">
          {images.slice(0, 6).map((file, index) => (
            <button
              key={file.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-hairline bg-bg text-left"
              aria-label={`เปิดรูป ${file.originalFilename}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fileHref(file.id)}
                alt={file.originalFilename}
                className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.025]"
              />
              {index === 5 && images.length > 6 && (
                <span className="absolute inset-0 grid place-items-center bg-black/55 text-sm font-semibold text-white">
                  +{images.length - 6}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {documents.length > 0 && (
        <div className="grid max-w-2xl gap-2 sm:grid-cols-2">
          {documents.map((file) => (
            <a
              key={file.id}
              href={fileHref(file.id)}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 items-center gap-3 rounded-lg border border-hairline bg-surface px-3 py-2.5 text-left transition-colors hover:border-blue-400 hover:bg-blue-500/5 hover:no-underline"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-bg text-blue-700">
                <FileText className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">
                  {file.originalFilename}
                </span>
                <span className="block text-xs text-ink-mute">
                  {formatBytes(file.sizeBytes)}
                </span>
              </span>
              <ExternalLink className="h-4 w-4 shrink-0 text-ink-mute" />
            </a>
          ))}
        </div>
      )}

      {activeIndex !== null && (
        <ImageDialog
          images={images}
          activeIndex={activeIndex}
          onChange={setActiveIndex}
          onClose={() => setActiveIndex(null)}
        />
      )}
    </div>
  );
}

function ImageDialog({
  images,
  activeIndex,
  onChange,
  onClose,
}: {
  images: QuizAttachmentView[];
  activeIndex: number;
  onChange: (index: number) => void;
  onClose: () => void;
}) {
  const active = images[activeIndex];
  const canMove = images.length > 1;

  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && canMove) {
        onChange((activeIndex - 1 + images.length) % images.length);
      }
      if (event.key === "ArrowRight" && canMove) {
        onChange((activeIndex + 1) % images.length);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = before;
      window.removeEventListener("keydown", keydown);
    };
  }, [activeIndex, canMove, images.length, onChange, onClose]);

  if (!active) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`ดูรูป ${active.originalFilename}`}
      className="fixed inset-0 z-[9999] grid place-items-center bg-black/90 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex h-[calc(100vh-2rem)] w-full items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute left-0 top-0 z-10 max-w-[calc(100%-4rem)] rounded-full bg-white/10 px-3 py-2 text-xs font-medium text-white backdrop-blur">
          <span className="block max-w-[60vw] truncate">
            {active.originalFilename}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-0 top-0 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          aria-label="ปิดรูป"
        >
          <X className="h-5 w-5" />
        </button>
        {canMove && (
          <button
            type="button"
            onClick={() =>
              onChange((activeIndex - 1 + images.length) % images.length)
            }
            className="absolute left-0 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="รูปก่อนหน้า"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fileHref(active.id)}
          alt={active.originalFilename}
          className="h-full w-full object-contain"
        />
        {canMove && (
          <button
            type="button"
            onClick={() => onChange((activeIndex + 1) % images.length)}
            className="absolute right-0 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="รูปถัดไป"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
        {canMove && (
          <span className="absolute bottom-0 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            {activeIndex + 1} / {images.length}
          </span>
        )}
      </div>
    </div>,
    document.body
  );
}

function fileHref(id: string): string {
  return `/api/storage/files/${id}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
