"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Cropper, { type Area } from "react-easy-crop";
import { Camera, Trash2, X } from "lucide-react";
import {
  deleteProfileImageAction,
  saveProfileImageAction,
} from "@/app/profile/actions";
import { UserAvatar } from "./user-avatar";

/**
 * Avatar editor — Phase 13.
 *
 * choose image → crop modal (1:1, circular preview, zoom) →
 * "บันทึกรูปโปรไฟล์". The ORIGINAL file never leaves the browser: the
 * crop is rendered to a 512×512 JPEG canvas client-side and only that
 * output rides the existing presign → PUT → commit pipeline
 * (ownerType PROFILE_IMAGE, ownerId = self). Delete returns the user to
 * the shared default avatar after an inline confirm.
 */

const OUTPUT_SIZE = 512;

type Phase =
  | { kind: "idle" }
  | { kind: "cropping"; src: string }
  | { kind: "saving" }
  | { kind: "error"; message: string };

export function AvatarEditor({
  userId,
  hasImage,
  version,
}: {
  userId: string;
  hasImage: boolean;
  version?: string | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function onPickFile(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhase({ kind: "error", message: "เลือกไฟล์รูปภาพเท่านั้น" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedArea(null);
      setPhase({ kind: "cropping", src: String(reader.result) });
      // Defer so the dialog exists before showModal.
      requestAnimationFrame(() => dialogRef.current?.showModal());
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function closeCropper() {
    dialogRef.current?.close();
    setPhase({ kind: "idle" });
  }

  async function saveCrop() {
    if (phase.kind !== "cropping" || !croppedArea) return;
    const src = phase.src;
    setPhase({ kind: "saving" });
    try {
      const blob = await renderCrop(src, croppedArea);

      // 1. presign into the caller's own PROFILE_IMAGE scope
      const presignRes = await fetch("/api/storage/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ownerType: "PROFILE_IMAGE",
          ownerId: userId,
          declaredMime: "image/jpeg",
          declaredSize: blob.size,
          originalFilename: "avatar.jpg",
        }),
      });
      if (!presignRes.ok) throw new Error("presign_failed");
      const { uploadUrl, commitToken } = (await presignRes.json()) as {
        uploadUrl: string;
        commitToken: string;
      };

      // 2. PUT the cropped bytes
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "content-type": "image/jpeg" },
        body: blob,
      });
      if (!putRes.ok) throw new Error("upload_failed");

      // 3. commit (magic-byte verify + EXIF strip server-side)
      const commitRes = await fetch("/api/storage/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ commitToken, originalFilename: "avatar.jpg" }),
      });
      if (!commitRes.ok) throw new Error("commit_failed");
      const { fileId } = (await commitRes.json()) as { fileId: string };

      // 4. point the profile at the new attachment (audited)
      const result = await saveProfileImageAction(fileId);
      if (!result.ok) throw new Error(result.error ?? "save_failed");

      dialogRef.current?.close();
      setPhase({ kind: "idle" });
      router.refresh();
    } catch (err) {
      dialogRef.current?.close();
      setPhase({
        kind: "error",
        message:
          err instanceof Error && err.message !== "save_failed"
            ? `อัปโหลดไม่สำเร็จ (${err.message}) — ลองใหม่อีกครั้ง`
            : "บันทึกรูปไม่สำเร็จ — ลองใหม่อีกครั้ง",
      });
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    const result = await deleteProfileImageAction();
    setDeleting(false);
    setConfirmingDelete(false);
    if (result.ok) router.refresh();
    else if (result.error) setPhase({ kind: "error", message: result.error });
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      <UserAvatar
        userId={userId}
        hasImage={hasImage}
        version={version}
        size={96}
        alt="รูปโปรไฟล์ของฉัน"
      />

      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={phase.kind === "saving" || deleting}
          >
            <Camera className="h-4 w-4" aria-hidden="true" />
            {hasImage ? "เปลี่ยนรูปโปรไฟล์" : "อัปโหลดรูปโปรไฟล์"}
          </button>
          {hasImage && !confirmingDelete && (
            <button
              type="button"
              className="btn-ghost btn-sm text-red-700 hover:bg-red-50"
              onClick={() => setConfirmingDelete(true)}
              disabled={phase.kind === "saving" || deleting}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              ลบรูป
            </button>
          )}
        </div>

        {confirmingDelete && (
          <div className="rounded-xl bg-red-50/70 p-3 ring-1 ring-red-500/15">
            <p className="text-xs text-black/70">
              ลบรูปโปรไฟล์? ระบบจะกลับไปใช้รูปเริ่มต้น
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="btn-danger btn-sm"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? "กำลังลบ…" : "ยืนยันลบรูป"}
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
              >
                ไม่ลบ
              </button>
            </div>
          </div>
        )}

        <p className="text-xs text-black/45">
          รูปจะถูกครอปเป็นสี่เหลี่ยมจัตุรัส 512×512 — ระบบไม่เก็บไฟล์ต้นฉบับ
        </p>
        {phase.kind === "error" && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {phase.message}
          </p>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => onPickFile(e.target.files)}
      />

      {/* Crop modal — native <dialog> (Pattern 7). */}
      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-md rounded-2xl border border-black/10 bg-white p-0 shadow-soft backdrop:bg-black/40"
        onClose={() => {
          if (phase.kind === "cropping") setPhase({ kind: "idle" });
        }}
      >
        {(phase.kind === "cropping" || phase.kind === "saving") && (
          <div className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-black">
                ครอปรูปโปรไฟล์
              </h3>
              <button
                type="button"
                onClick={closeCropper}
                className="grid h-8 w-8 place-items-center rounded-full text-black/45 hover:bg-black/5 hover:text-black"
                aria-label="ปิด"
                disabled={phase.kind === "saving"}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="relative mt-4 h-72 w-full overflow-hidden rounded-xl bg-black/80">
              {phase.kind === "cropping" && (
                <Cropper
                  image={phase.src}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_area, areaPixels) =>
                    setCroppedArea(areaPixels)
                  }
                />
              )}
              {phase.kind === "saving" && (
                <div className="grid h-full place-items-center text-sm text-white/80">
                  กำลังอัปโหลด…
                </div>
              )}
            </div>

            {phase.kind === "cropping" && (
              <label className="mt-4 flex items-center gap-3 text-xs text-black/55">
                ซูม
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="h-1.5 flex-1 accent-blue-500"
                />
              </label>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={closeCropper}
                disabled={phase.kind === "saving"}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={saveCrop}
                disabled={phase.kind === "saving" || !croppedArea}
              >
                {phase.kind === "saving" ? "กำลังบันทึก…" : "บันทึกรูปโปรไฟล์"}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}

/** Draw the selected crop area onto a 512×512 canvas → JPEG blob. */
async function renderCrop(src: string, area: Area): Promise<Blob> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  ctx.drawImage(
    img,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE
  );
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("crop_failed"))),
      "image/jpeg",
      0.9
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image_load_failed"));
    img.src = src;
  });
}
