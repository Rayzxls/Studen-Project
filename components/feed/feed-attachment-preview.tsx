"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Link2,
  X,
} from "lucide-react";
import type { FeedAttachment } from "@/lib/feed/aggregator";
import { SafeExternalLinkButton } from "@/components/link/safe-external-link-button";

export function FeedAttachmentPreview({
  attachments,
  linkUrls = [],
  fileBasePath = "/api/storage/files",
}: {
  attachments: FeedAttachment[];
  linkUrls?: string[];
  fileBasePath?: string;
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
  const [activeDocument, setActiveDocument] = useState<FeedAttachment | null>(
    null
  );

  if (attachments.length === 0 && linkUrls.length === 0) return null;

  const visibleImages = images.slice(0, 4);
  const hiddenImageCount = Math.max(0, images.length - visibleImages.length);

  return (
    <div className="px-5 pt-4">
      {visibleImages.length > 0 && (
        <div
          className={
            "grid w-full max-w-[340px] overflow-hidden rounded-2xl border border-black/[0.06] bg-black/[0.03] sm:max-w-[380px] " +
            (visibleImages.length === 1 ? "grid-cols-1" : "grid-cols-2")
          }
        >
          {visibleImages.map((file, index) => (
            <button
              key={file.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-black/[0.04] text-left"
              aria-label={`เปิดรูป ${file.originalFilename}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fileHref(file.id, fileBasePath)}
                alt={file.originalFilename}
                className="h-full w-full object-contain transition-transform duration-300 hover:scale-[1.02]"
              />
              {hiddenImageCount > 0 && index === visibleImages.length - 1 && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-lg font-semibold text-white">
                  +{hiddenImageCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {(documents.length > 0 || linkUrls.length > 0) && (
        <div
          className={
            visibleImages.length > 0
              ? "mt-2 max-w-[380px] space-y-2"
              : "max-w-[380px] space-y-2"
          }
        >
          {documents.map((file) => (
            <button
              key={file.id}
              type="button"
              onClick={() => setActiveDocument(file)}
              className="flex w-full items-center gap-3 rounded-xl border border-black/[0.06] bg-black/[0.025] px-3 py-2.5 text-left text-sm transition hover:bg-blue-50/70"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-black/55">
                <FileText className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-black">
                  {file.originalFilename}
                </span>
                <span className="block text-xs text-black/40">
                  {formatBytes(file.sizeBytes)}
                </span>
              </span>
              <span className="shrink-0 text-xs font-medium text-blue-700">
                เปิดดู
              </span>
            </button>
          ))}

          {linkUrls.map((href, index) => (
            <SafeExternalLinkButton
              key={`${href}-${index}`}
              href={href}
              className="flex w-full items-center gap-3 rounded-xl border border-black/[0.08] bg-black/[0.025] px-3 py-2.5 text-left text-sm transition hover:border-blue-500/30 hover:bg-black/[0.04] hover:no-underline"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/[0.04] text-blue-600">
                <Link2 className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-black">
                  {formatLinkLabel(href)}
                </span>
                <span className="block truncate text-xs text-black/45">
                  {href}
                </span>
              </span>
              <span className="shrink-0 text-xs font-medium text-blue-700">
                เปิด
              </span>
            </SafeExternalLinkButton>
          ))}
        </div>
      )}

      {activeIndex !== null && (
        <ImagePreviewDialog
          images={images}
          activeIndex={activeIndex}
          fileBasePath={fileBasePath}
          onChange={setActiveIndex}
          onClose={() => setActiveIndex(null)}
        />
      )}

      {activeDocument && (
        <DocumentPreviewDialog
          file={activeDocument}
          fileBasePath={fileBasePath}
          onClose={() => setActiveDocument(null)}
        />
      )}
    </div>
  );
}

function ImagePreviewDialog({
  images,
  activeIndex,
  fileBasePath,
  onChange,
  onClose,
}: {
  images: FeedAttachment[];
  activeIndex: number;
  fileBasePath: string;
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
      aria-label="ตัวอย่างรูปภาพ"
      onClick={onClose}
    >
      <div
        className="relative flex h-[calc(100vh-2rem)] w-full items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute left-0 top-0 z-10 flex max-w-[calc(100%-4rem)] items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-medium text-white backdrop-blur">
          <span className="truncate">{active.originalFilename}</span>
          <a
            href={fileHref(active.id, fileBasePath)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-white/75 hover:text-white hover:no-underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            เปิดไฟล์จริง
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
          src={fileHref(active.id, fileBasePath)}
          alt={active.originalFilename}
          className="h-full w-full object-contain"
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

function DocumentPreviewDialog({
  file,
  fileBasePath,
  onClose,
}: {
  file: FeedAttachment;
  fileBasePath: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/82 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`ดูไฟล์ ${file.originalFilename}`}
      onClick={onClose}
    >
      <div
        className="relative flex h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-surface shadow-2xl ring-1 ring-white/10"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-black/[0.08] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-black">
              {file.originalFilename}
            </p>
            <p className="mt-0.5 text-xs text-black/45">
              {formatBytes(file.sizeBytes)}
              {file.mimeType ? ` · ${file.mimeType}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={fileHref(file.id, fileBasePath)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-black/55 transition hover:bg-black/[0.05] hover:text-black"
              title="เปิดแท็บใหม่"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
            <a
              href={fileHref(file.id, fileBasePath)}
              download={file.originalFilename}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-black/55 transition hover:bg-black/[0.05] hover:text-black"
              title="ดาวน์โหลด"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-black/55 transition hover:bg-black/[0.05] hover:text-black"
              aria-label="ปิดพรีวิว"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 place-items-center bg-black/[0.03] p-3">
          {file.mimeType === "application/pdf" ? (
            <iframe
              src={fileHref(file.id, fileBasePath)}
              title={file.originalFilename}
              className="h-full min-h-[65vh] w-full rounded-2xl bg-white"
            />
          ) : (
            <div className="max-w-sm rounded-2xl bg-white p-6 text-center shadow-lift">
              <FileText className="mx-auto h-10 w-10 text-black/30" />
              <p className="mt-3 text-sm font-semibold text-black">
                ไฟล์นี้ดูตัวอย่างในหน้าเว็บไม่ได้
              </p>
              <p className="mt-1 text-xs text-black/50">
                เปิดแท็บใหม่หรือดาวน์โหลดไฟล์เพื่อดูรายละเอียด
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <a
                  href={fileHref(file.id, fileBasePath)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary btn-sm"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  เปิดไฟล์
                </a>
                <a
                  href={fileHref(file.id, fileBasePath)}
                  download={file.originalFilename}
                  className="btn-ghost btn-sm"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  ดาวน์โหลด
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function fileHref(fileId: string, fileBasePath: string): string {
  return `${fileBasePath}/${fileId}`;
}

function formatLinkLabel(href: string): string {
  try {
    const url = new URL(href);
    const path = url.pathname === "/" ? "" : url.pathname;
    return `${url.hostname}${path}`;
  } catch {
    return href;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
