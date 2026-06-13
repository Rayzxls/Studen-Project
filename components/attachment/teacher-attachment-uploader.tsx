"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, ImageIcon, Loader2, Paperclip, X } from "lucide-react";
import { ALLOWED_MIME_TYPES, FILE_MAX_BYTES } from "@/lib/assignment/constants";

type OwnerType = "ASSIGNMENT" | "MATERIAL" | "ANNOUNCEMENT";

type UploadedFile = {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  previewUrl: string | null;
};

type UploadProgressEntry = {
  localId: string;
  name: string;
  sizeBytes: number;
  mimeType: string | null;
  previewUrl: string | null;
  status: "uploading" | "committing" | "error";
  percent: number;
  error?: string;
};

type ApiErrorBody = {
  error?:
    | string
    | {
        code?: string;
        message?: string;
        details?: Record<string, string>;
      };
  fieldErrors?: Record<string, string>;
};

const HUMAN_MAX_MB = Math.round(FILE_MAX_BYTES / (1024 * 1024));
const MAX_FILES = 10;

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

const ACCEPT = ALLOWED_MIME_TYPES.join(",");

export function TeacherAttachmentUploader({
  ownerType,
  ownerId,
  error,
  onBusyChange,
}: {
  ownerType: OwnerType;
  ownerId: string;
  error?: string;
  onBusyChange?: (busy: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadedRef = useRef<UploadedFile[]>([]);
  const inFlightRef = useRef<UploadProgressEntry[]>([]);
  const [uploaded, setUploaded] = useState<UploadedFile[]>([]);
  const [inFlight, setInFlight] = useState<UploadProgressEntry[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const busy = inFlight.some((e) => e.status !== "error");

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  useEffect(() => {
    uploadedRef.current = uploaded;
  }, [uploaded]);

  useEffect(() => {
    inFlightRef.current = inFlight;
  }, [inFlight]);

  useEffect(() => {
    return () => {
      uploadedRef.current.forEach((file) => {
        if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
      });
      inFlightRef.current.forEach((file) => {
        if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
      });
    };
  }, []);

  function updateInFlight(
    localId: string,
    patch: Partial<UploadProgressEntry>
  ) {
    setInFlight((prev) =>
      prev.map((entry) =>
        entry.localId === localId ? { ...entry, ...patch } : entry
      )
    );
  }

  async function uploadOne(file: File) {
    setLocalError(null);

    if (!ownerId) {
      setLocalError(
        "ระบบยังไม่พร้อมแนบไฟล์ ลองปิดแล้วเปิดหน้าสร้างใหม่อีกครั้ง"
      );
      return;
    }

    const totalFiles = uploaded.length + inFlight.length;
    if (totalFiles >= MAX_FILES) {
      setLocalError(`แนบไฟล์ได้สูงสุด ${MAX_FILES} ไฟล์`);
      return;
    }

    const declaredMime = inferAllowedMime(file);
    if (!declaredMime) {
      setLocalError("รองรับเฉพาะ PDF / รูปภาพ / Office docs");
      return;
    }

    if (file.size <= 0 || file.size > FILE_MAX_BYTES) {
      setLocalError(`ไฟล์ต้องมีขนาดไม่เกิน ${HUMAN_MAX_MB} MB`);
      return;
    }

    const localId = crypto.randomUUID();
    const previewUrl = createPreviewUrl(file, declaredMime);
    setInFlight((prev) => [
      ...prev,
      {
        localId,
        name: file.name,
        sizeBytes: file.size,
        mimeType: declaredMime,
        previewUrl,
        status: "uploading",
        percent: 0,
      },
    ]);

    try {
      const presignRes = await fetch("/api/storage/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ownerType,
          ownerId,
          declaredMime,
          declaredSize: file.size,
          originalFilename: file.name,
        }),
      });
      if (!presignRes.ok) {
        const body = (await presignRes
          .json()
          .catch(() => ({}))) as ApiErrorBody;
        throw new Error(formatUploadError(body, "presign_failed"));
      }
      const { uploadUrl, commitToken } = (await presignRes.json()) as {
        uploadUrl: string;
        commitToken: string;
      };

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("content-type", declaredMime);
        xhr.upload.addEventListener("progress", (ev) => {
          if (!ev.lengthComputable) return;
          updateInFlight(localId, {
            percent: Math.max(1, Math.round((ev.loaded / ev.total) * 90)),
          });
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error("storage_put_failed"));
        });
        xhr.addEventListener("error", () =>
          reject(new Error("storage_put_network"))
        );
        xhr.send(file);
      });

      updateInFlight(localId, { status: "committing", percent: 96 });

      const commitRes = await fetch("/api/storage/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ commitToken, originalFilename: file.name }),
      });
      if (!commitRes.ok) {
        const body = (await commitRes.json().catch(() => ({}))) as ApiErrorBody;
        throw new Error(formatUploadError(body, "commit_failed"));
      }
      const row = (await commitRes.json()) as {
        fileId: string;
        sizeBytes?: number;
      };

      setUploaded((prev) => [
        ...prev,
        {
          id: row.fileId,
          name: file.name,
          sizeBytes: row.sizeBytes ?? file.size,
          mimeType: declaredMime,
          previewUrl,
        },
      ]);
      setInFlight((prev) => prev.filter((entry) => entry.localId !== localId));
    } catch (err) {
      updateInFlight(localId, {
        status: "error",
        percent: 0,
        error: err instanceof Error ? err.message : "upload_failed",
      });
    }
  }

  function onFilesPicked(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files).slice(0, MAX_FILES)) {
      void uploadOne(file);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeUploaded(fileId: string) {
    setUploaded((prev) => {
      const removed = prev.find((file) => file.id === fileId);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((file) => file.id !== fileId);
    });
  }

  function removeInFlight(localId: string) {
    setInFlight((prev) => {
      const removed = prev.find((file) => file.localId === localId);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((file) => file.localId !== localId);
    });
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name="ownerId" value={ownerId} />
      <input
        type="hidden"
        name="fileAttachmentIds"
        value={JSON.stringify(uploaded.map((file) => file.id))}
      />
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        onChange={(event) => onFilesPicked(event.target.files)}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={!ownerId || uploaded.length + inFlight.length >= MAX_FILES}
        className="flex w-full items-center gap-2 rounded-xl border border-dashed border-black/15 bg-black/[0.015] px-3 py-2.5 text-left text-xs font-medium text-black/55 transition-colors hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Paperclip className="h-4 w-4 shrink-0" aria-hidden="true" />
        แนบไฟล์ / รูป
        <span className="ml-auto text-[11px] font-normal text-black/35">
          สูงสุด {MAX_FILES} ไฟล์ · {HUMAN_MAX_MB} MB/ไฟล์
        </span>
      </button>

      {(uploaded.length > 0 || inFlight.length > 0) && (
        <div className="space-y-2 rounded-xl bg-black/[0.02] p-2">
          {uploaded.map((file) => (
            <FileRow
              key={file.id}
              name={file.name}
              sizeBytes={file.sizeBytes}
              mimeType={file.mimeType}
              previewUrl={file.previewUrl}
              onRemove={() => removeUploaded(file.id)}
            />
          ))}
          {inFlight.map((file) => (
            <FileRow
              key={file.localId}
              name={file.name}
              sizeBytes={file.sizeBytes}
              mimeType={file.mimeType}
              previewUrl={file.previewUrl}
              progress={file.percent}
              error={file.error}
              busy={file.status !== "error"}
              onRemove={() => removeInFlight(file.localId)}
            />
          ))}
        </div>
      )}

      {(localError || error) && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {localError ?? error}
        </p>
      )}
    </div>
  );
}

function FileRow({
  name,
  sizeBytes,
  mimeType,
  previewUrl,
  progress,
  error,
  busy,
  onRemove,
}: {
  name: string;
  sizeBytes: number;
  mimeType: string | null;
  previewUrl: string | null;
  progress?: number;
  error?: string;
  busy?: boolean;
  onRemove: () => void;
}) {
  const isImage = mimeType?.startsWith("image/") ?? false;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-black/[0.06] bg-white px-2.5 py-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/[0.04]">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
        ) : isImage ? (
          <ImageIcon className="h-4 w-4 text-black/45" />
        ) : (
          <FileText className="h-4 w-4 text-black/45" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-black">{name}</p>
        <p className="mt-0.5 text-[11px] text-black/40">
          {error
            ? error
            : busy
              ? `กำลังอัปโหลด ${progress ?? 0}%`
              : `อัปโหลดแล้ว · ${formatBytes(sizeBytes)}`}
        </p>
        {busy && (
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/[0.06]">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{ width: `${Math.max(progress ?? 0, 4)}%` }}
            />
          </div>
        )}
      </div>
      {busy && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-1 text-black/35 transition-colors hover:bg-black/[0.05] hover:text-black"
        aria-label={`เอาไฟล์ ${name} ออก`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function inferAllowedMime(file: File): string | null {
  if ((ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return file.type;
  }
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension) return null;
  const inferred = MIME_BY_EXTENSION[extension];
  if ((ALLOWED_MIME_TYPES as readonly string[]).includes(inferred)) {
    return inferred;
  }
  return null;
}

function createPreviewUrl(file: File, mimeType: string | null): string | null {
  if (!mimeType?.startsWith("image/")) return null;
  return URL.createObjectURL(file);
}

function formatUploadError(body: ApiErrorBody, fallback: string): string {
  const directFieldError =
    body.fieldErrors?.commitToken ??
    body.fieldErrors?.declaredMime ??
    body.fieldErrors?.originalFilename;
  if (directFieldError) return directFieldError;
  if (typeof body.error === "string") return humanUploadError(body.error);
  const details = body.error?.details;
  const detailMessage =
    details?.commitToken ??
    details?.declaredMime ??
    details?.originalFilename ??
    details?._;
  if (detailMessage) return humanUploadError(detailMessage);
  return humanUploadError(body.error?.message ?? body.error?.code ?? fallback);
}

function humanUploadError(code: string): string {
  switch (code) {
    case "mime_not_whitelisted":
    case "type_undetectable":
      return "ชนิดไฟล์นี้ยังไม่รองรับ";
    case "mime_mismatch":
      return "ชนิดไฟล์ไม่ตรงกับไฟล์จริง ลองบันทึกไฟล์ใหม่แล้วอัปโหลดอีกครั้ง";
    case "staging_object_missing":
    case "size_mismatch":
      return "อัปโหลดไฟล์ไม่สมบูรณ์ ลองเลือกไฟล์ใหม่อีกครั้ง";
    case "server_misconfigured":
    case "internal_error":
      return "ระบบอัปโหลดไฟล์ยังไม่พร้อมใช้งาน";
    case "storage_put_failed":
    case "storage_put_network":
      return "เชื่อมต่อระบบอัปโหลดไฟล์ไม่ได้ ลองใหม่อีกครั้ง";
    default:
      return code;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
