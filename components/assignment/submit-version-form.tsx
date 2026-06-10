"use client";

import { useActionState, useRef, useState } from "react";
import {
  submitVersionAction,
  type SubmitVersionState,
} from "@/app/student/courses/[id]/assignments/actions";
import { ALLOWED_MIME_TYPES, FILE_MAX_BYTES } from "@/lib/assignment/constants";

/**
 * Student submit form (Phase 7 · P7-0c).
 *
 * Initial submit or voluntary resubmit. Each successful submit creates
 * a new SubmissionVersion via lib/assignment.submitVersion. Pattern 6
 * (hidden submissionId / assignmentId / courseId), Pattern 8 (server
 * action async export).
 *
 * Per-channel allow* state is passed in as props — fields that the
 * Assignment did not enable are hidden entirely. File uploads run via
 * the /api/storage/presign + PUT-to-R2 + /api/storage/commit handshake
 * before form submission; committed FileAttachment ids ride in a hidden
 * JSON input that the server action deserialises.
 *
 * The "หากเคยส่งแล้ว ครูจะเห็นเวอร์ชันล่าสุด" copy + the resubmit
 * confirmation pattern is intentionally a textual cue rather than a
 * native <dialog> — Pattern 7 is reserved for actions with side effects
 * the student should explicitly acknowledge; we still warn but do not
 * block voluntary resubmit (ADR-0020 § 3 V1 lock).
 */

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
  status: "uploading" | "committing" | "done" | "error";
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

function isImageMime(mimeType: string | null): boolean {
  return mimeType?.startsWith("image/") ?? false;
}

function createPreviewUrl(file: File, mimeType: string | null): string | null {
  if (!isImageMime(mimeType)) return null;
  return URL.createObjectURL(file);
}

function formatUploadError(body: ApiErrorBody, fallback: string): string {
  const directFieldError =
    body.fieldErrors?.commitToken ??
    body.fieldErrors?.declaredMime ??
    body.fieldErrors?.originalFilename;
  if (directFieldError) return directFieldError;

  if (typeof body.error === "string") return body.error;

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
    case "type_undetectable":
      return "ตรวจชนิดไฟล์ไม่ได้ ลองบันทึกรูปเป็น JPG/PNG แล้วอัปโหลดใหม่";
    case "mime_not_whitelisted":
      return "ชนิดไฟล์นี้ยังไม่รองรับ";
    case "mime_mismatch":
      return "ชนิดไฟล์ไม่ตรงกับไฟล์จริง ลองเปลี่ยนชื่อ/บันทึกไฟล์ใหม่แล้วอัปโหลดอีกครั้ง";
    case "staging_object_missing":
      return "อัปโหลดไฟล์ไม่สมบูรณ์ ลองเลือกไฟล์ใหม่อีกครั้ง";
    case "validation_error":
      return "ข้อมูลไฟล์ไม่ถูกต้อง";
    case "size_mismatch":
      return "ขนาดไฟล์ที่อัปโหลดไม่ตรงกับไฟล์ที่เลือก ลองเลือกไฟล์ใหม่อีกครั้ง";
    case "server_misconfigured":
    case "internal_error":
      return "ระบบอัปโหลดไฟล์ยังไม่พร้อมใช้งานบนเครื่องนี้";
    case "r2_put_network":
    case "storage_put_network":
      return "เชื่อมต่อระบบอัปโหลดไฟล์ไม่ได้ ลองใหม่อีกครั้ง";
    default:
      return code;
  }
}

export function SubmitVersionForm({
  courseId,
  assignmentId,
  submissionId,
  allowText,
  allowFile,
  allowLink,
  hasExistingCurrent,
  startCollapsed = false,
  collapsedLabel,
  collapsedButtonClassName,
}: {
  courseId: string;
  assignmentId: string;
  submissionId: string;
  allowText: boolean;
  allowFile: boolean;
  allowLink: boolean;
  hasExistingCurrent: boolean;
  startCollapsed?: boolean;
  collapsedLabel?: string;
  collapsedButtonClassName?: string;
}) {
  const [state, formAction, isPending] = useActionState<
    SubmitVersionState,
    FormData
  >(submitVersionAction, {});

  const [uploaded, setUploaded] = useState<UploadedFile[]>([]);
  const [inFlight, setInFlight] = useState<UploadProgressEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEditingExisting, setIsEditingExisting] = useState(
    startCollapsed ? false : !hasExistingCurrent
  );
  const [localSubmitError, setLocalSubmitError] = useState<string | null>(null);

  const anyUploadInFlight = inFlight.some(
    (e) => e.status === "uploading" || e.status === "committing"
  );

  function updateInFlight(
    localId: string,
    patch: Partial<UploadProgressEntry>
  ) {
    setInFlight((prev) =>
      prev.map((e) => (e.localId === localId ? { ...e, ...patch } : e))
    );
  }

  function dropInFlight(
    localId: string,
    options?: { revokePreview?: boolean }
  ) {
    setInFlight((prev) => {
      const entry = prev.find((e) => e.localId === localId);
      if (options?.revokePreview !== false && entry?.previewUrl) {
        URL.revokeObjectURL(entry.previewUrl);
      }
      return prev.filter((e) => e.localId !== localId);
    });
  }

  async function uploadOne(file: File) {
    const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (file.size > FILE_MAX_BYTES) {
      setInFlight((prev) => [
        ...prev,
        {
          localId,
          name: file.name,
          sizeBytes: file.size,
          mimeType: file.type || null,
          previewUrl: createPreviewUrl(file, file.type || null),
          status: "error",
          percent: 0,
          error: `ไฟล์ใหญ่เกิน ${HUMAN_MAX_MB} MB`,
        },
      ]);
      return;
    }

    const declaredMime = inferAllowedMime(file);
    const previewUrl = createPreviewUrl(file, declaredMime);
    if (!declaredMime) {
      setInFlight((prev) => [
        ...prev,
        {
          localId,
          name: file.name,
          sizeBytes: file.size,
          mimeType: file.type || null,
          previewUrl,
          status: "error",
          percent: 0,
          error:
            "ประเภทไฟล์ไม่อนุญาต หรือระบบอ่านชนิดไฟล์ไม่ได้ (รองรับ PDF / รูปภาพ / Office docs)",
        },
      ]);
      return;
    }

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
      // 1. presign
      const presignRes = await fetch("/api/storage/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ownerType: "SUBMISSION",
          ownerId: submissionId,
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

      // 2. PUT to storage with XHR for progress (fetch lacks upload progress).
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("content-type", declaredMime);
        xhr.upload.addEventListener("progress", (ev) => {
          if (ev.lengthComputable) {
            const p = Math.round((ev.loaded / ev.total) * 100);
            updateInFlight(localId, { percent: p });
          }
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else {
            let message = `storage_put_${xhr.status}`;
            try {
              message = formatUploadError(
                JSON.parse(xhr.responseText) as ApiErrorBody,
                message
              );
            } catch {
              // Keep the status-based fallback.
            }
            reject(new Error(message));
          }
        });
        xhr.addEventListener("error", () =>
          reject(new Error(humanUploadError("storage_put_network")))
        );
        xhr.send(file);
      });

      // 3. commit
      updateInFlight(localId, { status: "committing", percent: 100 });
      const commitRes = await fetch("/api/storage/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          commitToken,
          originalFilename: file.name,
        }),
      });
      if (!commitRes.ok) {
        const body = (await commitRes.json().catch(() => ({}))) as ApiErrorBody;
        throw new Error(formatUploadError(body, "commit_failed"));
      }
      const { fileId } = (await commitRes.json()) as { fileId: string };

      // Promote to uploaded; remove from in-flight.
      setUploaded((prev) => [
        ...prev,
        {
          id: fileId,
          name: file.name,
          sizeBytes: file.size,
          mimeType: declaredMime,
          previewUrl,
        },
      ]);
      setLocalSubmitError(null);
      dropInFlight(localId, { revokePreview: false });
    } catch (err) {
      updateInFlight(localId, {
        status: "error",
        error: err instanceof Error ? err.message : "upload_failed",
      });
    }
  }

  function onPickFiles(list: FileList | null) {
    if (!list) return;
    for (const f of Array.from(list)) {
      void uploadOne(f);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeUploaded(id: string) {
    setUploaded((prev) => {
      const file = prev.find((u) => u.id === id);
      if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl);
      return prev.filter((u) => u.id !== id);
    });
  }

  function hasSubmissionContent(form: HTMLFormElement): boolean {
    const formData = new FormData(form);
    const textContent = String(formData.get("textContent") ?? "").trim();
    const links = String(formData.get("links") ?? "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const fileAttachmentIdsRaw = String(
      formData.get("fileAttachmentIds") ?? "[]"
    );

    let fileAttachmentIds: unknown = [];
    try {
      fileAttachmentIds = JSON.parse(fileAttachmentIdsRaw);
    } catch {
      fileAttachmentIds = [];
    }

    return (
      textContent.length > 0 ||
      links.length > 0 ||
      (Array.isArray(fileAttachmentIds) && fileAttachmentIds.length > 0)
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-4"
      onSubmit={(event) => {
        if (anyUploadInFlight) {
          event.preventDefault();
          setLocalSubmitError("รอให้อัปโหลดไฟล์เสร็จก่อนส่งงาน");
          return;
        }
        if (!hasSubmissionContent(event.currentTarget)) {
          event.preventDefault();
          setLocalSubmitError(
            "ต้องส่งอย่างน้อย 1 อย่าง (ข้อความ / ไฟล์ / ลิงก์)"
          );
          return;
        }
        setLocalSubmitError(null);
      }}
    >
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="submissionId" value={submissionId} />
      <input
        type="hidden"
        name="fileAttachmentIds"
        value={JSON.stringify(uploaded.map((u) => u.id))}
      />

      {(hasExistingCurrent || startCollapsed) && !isEditingExisting && (
        <button
          type="button"
          className={collapsedButtonClassName ?? "btn-primary btn-sm w-full"}
          onClick={() => setIsEditingExisting(true)}
        >
          {collapsedLabel ?? (hasExistingCurrent ? "แก้ไขงาน" : "เพิ่มงาน")}
        </button>
      )}

      {hasExistingCurrent && isEditingExisting && (
        <p className="rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-700">
          การส่งใหม่จะสร้างเวอร์ชันล่าสุดแทนของเดิม
          ครูยังดูประวัติทุกเวอร์ชันได้
        </p>
      )}

      {isEditingExisting && allowText && (
        <div>
          <label className="block text-xs font-medium text-black/70">
            ข้อความ
          </label>
          <textarea
            name="textContent"
            rows={6}
            maxLength={50_000}
            className="input mt-1 font-mono text-xs"
            placeholder="พิมพ์คำตอบ / คำอธิบายที่นี่"
          />
          {state.fieldErrors?.textContent && (
            <p className="mt-1 text-xs text-red-700">
              {state.fieldErrors.textContent}
            </p>
          )}
        </div>
      )}

      {isEditingExisting && allowFile && (
        <div>
          <label className="block text-xs font-medium text-black/70">
            ไฟล์แนบ (≤ {HUMAN_MAX_MB} MB ต่อไฟล์ · PDF / รูปภาพ / Office docs)
          </label>
          <div
            className={`mt-1 rounded-lg border border-dashed px-4 py-6 text-center transition-colors ${
              isDragOver
                ? "border-black/40 bg-black/[0.03]"
                : "border-black/15 bg-white"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              onPickFiles(e.dataTransfer.files);
            }}
          >
            <p className="text-xs text-black/60">
              ลากไฟล์มาวางที่นี่ หรือ{" "}
              <button
                type="button"
                className="font-medium text-black underline underline-offset-2"
                onClick={() => fileInputRef.current?.click()}
              >
                เลือกไฟล์
              </button>
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept={ALLOWED_MIME_TYPES.join(",")}
              onChange={(e) => onPickFiles(e.target.files)}
            />
          </div>

          {(uploaded.length > 0 || inFlight.length > 0) && (
            <ul className="mt-2 space-y-1.5">
              {uploaded.map((u) => (
                <li
                  key={u.id}
                  className="rounded-md border border-black/10 bg-white p-2 text-xs"
                >
                  <div className="flex items-center gap-3">
                    {u.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={u.previewUrl}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-lg border border-black/10 object-cover"
                      />
                    ) : (
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-black/[0.04] text-[10px] font-medium uppercase text-black/45">
                        file
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {u.name}
                      </span>
                      <span className="mt-0.5 block text-black/40">
                        อัปโหลดแล้ว · {Math.round(u.sizeBytes / 1024)} KB
                      </span>
                    </span>
                    <button
                      type="button"
                      className="shrink-0 text-xs text-red-700 hover:underline"
                      onClick={() => removeUploaded(u.id)}
                    >
                      นำออก
                    </button>
                  </div>
                </li>
              ))}
              {inFlight.map((e) => (
                <li
                  key={e.localId}
                  className="rounded-md border border-black/10 bg-white p-2 text-xs"
                >
                  <div className="flex items-center gap-3">
                    {e.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={e.previewUrl}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-lg border border-black/10 object-cover"
                      />
                    ) : (
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-black/[0.04] text-[10px] font-medium uppercase text-black/45">
                        file
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {e.name}
                      </span>
                      <span className="mt-0.5 block text-black/40">
                        {e.status === "uploading"
                          ? `กำลังอัปโหลด ${e.percent}%`
                          : e.status === "committing"
                            ? "กำลังตรวจไฟล์..."
                            : e.status === "error"
                              ? "อัปโหลดไม่สำเร็จ"
                              : "พร้อมส่ง"}
                      </span>
                    </span>
                    {e.status === "error" && (
                      <button
                        type="button"
                        className="shrink-0 text-xs text-black/50 hover:underline"
                        onClick={() => dropInFlight(e.localId)}
                      >
                        ปิด
                      </button>
                    )}
                  </div>
                  {(e.status === "uploading" || e.status === "committing") && (
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-black/10">
                      <div
                        className="h-full bg-black/60 transition-all"
                        style={{ width: `${e.percent}%` }}
                      />
                    </div>
                  )}
                  {e.status === "error" && e.error && (
                    <p className="mt-1 text-xs text-red-700">{e.error}</p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {state.fieldErrors?.fileAttachmentIds && (
            <p className="mt-1 text-xs text-red-700">
              {state.fieldErrors.fileAttachmentIds}
            </p>
          )}
        </div>
      )}

      {isEditingExisting && allowLink && (
        <div>
          <label className="block text-xs font-medium text-black/70">
            ลิงก์ (แต่ละลิงก์ขึ้นบรรทัดใหม่ · สูงสุด 10)
          </label>
          <textarea
            name="links"
            rows={3}
            className="input mt-1 font-mono text-xs"
            placeholder="https://docs.google.com/..."
          />
          {state.fieldErrors?.links && (
            <p className="mt-1 text-xs text-red-700">
              {state.fieldErrors.links}
            </p>
          )}
        </div>
      )}

      {isEditingExisting && state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.error === "submission_closed"
            ? "ครูปิดการส่งแล้ว — ไม่สามารถส่งงานนี้ได้"
            : state.error === "auto_closed_at_due"
              ? "เลยกำหนดส่งและการส่งอัตโนมัติปิดแล้ว"
              : state.error}
        </p>
      )}

      {isEditingExisting && localSubmitError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {localSubmitError}
        </p>
      )}

      {isEditingExisting && (
        <div className="flex justify-end gap-2">
          {hasExistingCurrent && (
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => setIsEditingExisting(false)}
              disabled={isPending || anyUploadInFlight}
            >
              ปิด
            </button>
          )}
          <button
            type="submit"
            className="btn-primary btn-sm"
            disabled={isPending || anyUploadInFlight}
          >
            {isPending
              ? "กำลังส่ง…"
              : anyUploadInFlight
                ? "รออัปโหลดเสร็จก่อน…"
                : hasExistingCurrent
                  ? "ส่งใหม่ (แทนที่เวอร์ชันเก่า)"
                  : "ส่งงาน"}
          </button>
        </div>
      )}
    </form>
  );
}
