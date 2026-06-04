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

type UploadedFile = { id: string; name: string; sizeBytes: number };
type UploadProgressEntry = {
  localId: string;
  name: string;
  sizeBytes: number;
  status: "uploading" | "committing" | "done" | "error";
  percent: number;
  error?: string;
};

const HUMAN_MAX_MB = Math.round(FILE_MAX_BYTES / (1024 * 1024));

export function SubmitVersionForm({
  courseId,
  assignmentId,
  submissionId,
  allowText,
  allowFile,
  allowLink,
  hasExistingCurrent,
}: {
  courseId: string;
  assignmentId: string;
  submissionId: string;
  allowText: boolean;
  allowFile: boolean;
  allowLink: boolean;
  hasExistingCurrent: boolean;
}) {
  const [state, formAction, isPending] = useActionState<
    SubmitVersionState,
    FormData
  >(submitVersionAction, {});

  const [uploaded, setUploaded] = useState<UploadedFile[]>([]);
  const [inFlight, setInFlight] = useState<UploadProgressEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

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

  function dropInFlight(localId: string) {
    setInFlight((prev) => prev.filter((e) => e.localId !== localId));
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
          status: "error",
          percent: 0,
          error: `ไฟล์ใหญ่เกิน ${HUMAN_MAX_MB} MB`,
        },
      ]);
      return;
    }

    const declaredMime = file.type;
    if (
      !(ALLOWED_MIME_TYPES as readonly string[]).includes(declaredMime || "")
    ) {
      setInFlight((prev) => [
        ...prev,
        {
          localId,
          name: file.name,
          sizeBytes: file.size,
          status: "error",
          percent: 0,
          error: "ประเภทไฟล์ไม่อนุญาต (PDF / รูปภาพ / Office docs เท่านั้น)",
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
        const body = (await presignRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "presign_failed");
      }
      const { uploadUrl, commitToken } = (await presignRes.json()) as {
        uploadUrl: string;
        commitToken: string;
      };

      // 2. PUT to R2 with XHR for progress (fetch lacks upload progress).
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
          else reject(new Error(`r2_put_${xhr.status}`));
        });
        xhr.addEventListener("error", () =>
          reject(new Error("r2_put_network"))
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
        const body = (await commitRes.json().catch(() => ({}))) as {
          error?: string;
          fieldErrors?: Record<string, string>;
        };
        throw new Error(
          body.fieldErrors?.commitToken ?? body.error ?? "commit_failed"
        );
      }
      const { fileId } = (await commitRes.json()) as { fileId: string };

      // Promote to uploaded; remove from in-flight.
      setUploaded((prev) => [
        ...prev,
        { id: fileId, name: file.name, sizeBytes: file.size },
      ]);
      dropInFlight(localId);
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
    setUploaded((prev) => prev.filter((u) => u.id !== id));
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="submissionId" value={submissionId} />
      <input
        type="hidden"
        name="fileAttachmentIds"
        value={JSON.stringify(uploaded.map((u) => u.id))}
      />

      {hasExistingCurrent && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          คุณส่งงานนี้ไปแล้ว — การส่งใหม่จะแทนที่เป็นเวอร์ชันใหม่
          (ครูเห็นประวัติทุกเวอร์ชัน)
        </p>
      )}

      {allowText && (
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
            <p className="mt-1 text-xs text-rose-600">
              {state.fieldErrors.textContent}
            </p>
          )}
        </div>
      )}

      {allowFile && (
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
                  className="flex items-center justify-between rounded-md border border-black/10 bg-white px-3 py-1.5 text-xs"
                >
                  <span className="truncate pr-2">
                    <span className="font-medium">{u.name}</span>
                    <span className="ml-2 text-black/40">
                      {Math.round(u.sizeBytes / 1024)} KB
                    </span>
                  </span>
                  <button
                    type="button"
                    className="text-xs text-rose-600 hover:underline"
                    onClick={() => removeUploaded(u.id)}
                  >
                    นำออก
                  </button>
                </li>
              ))}
              {inFlight.map((e) => (
                <li
                  key={e.localId}
                  className="rounded-md border border-black/10 bg-white px-3 py-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate pr-2">
                      <span className="font-medium">{e.name}</span>
                      <span className="ml-2 text-black/40">
                        {e.status === "uploading"
                          ? `${e.percent}%`
                          : e.status === "committing"
                            ? "กำลังตรวจไฟล์…"
                            : e.status === "error"
                              ? "❌"
                              : "✓"}
                      </span>
                    </span>
                    {e.status === "error" && (
                      <button
                        type="button"
                        className="text-xs text-black/50 hover:underline"
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
                    <p className="mt-1 text-xs text-rose-600">{e.error}</p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {state.fieldErrors?.fileAttachmentIds && (
            <p className="mt-1 text-xs text-rose-600">
              {state.fieldErrors.fileAttachmentIds}
            </p>
          )}
        </div>
      )}

      {allowLink && (
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
            <p className="mt-1 text-xs text-rose-600">
              {state.fieldErrors.links}
            </p>
          )}
        </div>
      )}

      {state.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {state.error === "submission_closed"
            ? "ครูปิดการส่งแล้ว — ไม่สามารถส่งงานนี้ได้"
            : state.error === "auto_closed_at_due"
              ? "เลยกำหนดส่งและการส่งอัตโนมัติปิดแล้ว"
              : state.error}
        </p>
      )}

      <div className="flex justify-end">
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
    </form>
  );
}
