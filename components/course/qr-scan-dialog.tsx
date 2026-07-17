"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { parseJoinCode } from "@/lib/course/parse-join-code";

/**
 * In-app QR scanner — opens the device camera inside a native <dialog>
 * (Pattern 7) and decodes frames locally with jsQR. No frame ever leaves
 * the browser. The camera is requested only after the student taps the
 * scan button, and every track is stopped the moment the dialog closes.
 *
 * jsQR is imported dynamically inside the effect so the decoder never
 * enters the initial bundle (CLAUDE.md perf budget).
 */

type ScanState =
  | { kind: "starting" }
  | { kind: "scanning" }
  | { kind: "error"; message: string };

const DECODE_INTERVAL_MS = 250;

export function QrScanDialog({
  open,
  onClose,
  onCode,
}: {
  open: boolean;
  onClose: () => void;
  /** Called with the validated class code; parent closes the dialog. */
  onCode: (code: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<ScanState>({ kind: "starting" });

  const handleClose = useCallback(() => {
    dialogRef.current?.close();
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const dialog = dialogRef.current;
    const video = videoRef.current;
    if (!dialog || !video) return;

    dialog.showModal();
    setState({ kind: "starting" });

    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setState({
          kind: "error",
          message: "เบราว์เซอร์นี้ใช้กล้องไม่ได้ — พิมพ์รหัสด้านล่างแทนได้เลย",
        });
        return;
      }
      try {
        const [{ default: jsQR }, mediaStream] = await Promise.all([
          import("jsqr"),
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          }),
        ]);
        if (cancelled) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = mediaStream;
        video.srcObject = mediaStream;
        await video.play();
        setState({ kind: "scanning" });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("canvas_unavailable");

        timer = setInterval(() => {
          if (video.readyState < video.HAVE_ENOUGH_DATA) return;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          // attemptBoth: dark-theme surfaces can present the QR inverted
          // (light modules on dark) — decode both polarities per frame.
          const found = jsQR(img.data, img.width, img.height, {
            inversionAttempts: "attemptBoth",
          });
          if (!found) return;
          const code = parseJoinCode(found.data);
          if (code) {
            if (timer) clearInterval(timer);
            onCode(code);
          }
        }, DECODE_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        const denied =
          err instanceof DOMException &&
          (err.name === "NotAllowedError" || err.name === "SecurityError");
        setState({
          kind: "error",
          message: denied
            ? "ไม่ได้รับอนุญาตให้ใช้กล้อง — เปิดสิทธิ์กล้องในเบราว์เซอร์ หรือพิมพ์รหัสแทน"
            : "เปิดกล้องไม่สำเร็จ — พิมพ์รหัสด้านล่างแทนได้เลย",
        });
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
  }, [open, onCode]);

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-black/10 bg-white p-0 shadow-soft backdrop:bg-black/50"
      onClose={onClose}
    >
      {open && (
        <div className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-black">
              สแกน QR เข้าห้องเรียน
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="grid h-11 w-11 place-items-center rounded-full text-black/45 hover:bg-black/5 hover:text-black"
              aria-label="ปิดตัวสแกน"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="relative mt-3 aspect-square w-full overflow-hidden rounded-xl bg-black">
            {}
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            {state.kind === "scanning" && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-6 rounded-xl border-2 border-white/70"
              />
            )}
            {state.kind === "starting" && (
              <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-white/80">
                กำลังเปิดกล้อง…
              </p>
            )}
            {state.kind === "error" && (
              <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-white/90">
                {state.message}
              </p>
            )}
          </div>

          <p
            className="mt-3 text-center text-xs text-black/55"
            aria-live="polite"
          >
            {state.kind === "scanning"
              ? "เล็งกล้องไปที่ QR ของครู — ระบบจะกรอกรหัสให้อัตโนมัติ"
              : "ภาพจากกล้องประมวลผลในเครื่องเท่านั้น ไม่ถูกส่งขึ้นเซิร์ฟเวอร์"}
          </p>
        </div>
      )}
    </dialog>
  );
}
