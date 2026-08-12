"use client";

import { createPortal } from "react-dom";
import { MonitorX, RefreshCw } from "lucide-react";

import type { ScreenShare } from "@/components/meeting/use-screen-share";

/**
 * The room's own sharing indicator, and the two things you might want to do
 * about it (ADR-0053).
 *
 * Bottom right, and small. The browser pins its own sharing notice to the
 * bottom *centre* of the screen and no page can move it, hide it or restyle it
 * — it is a mandatory privacy indicator. The corner is the one place near the
 * controls that the browser's bar never reaches, so the two never stack.
 *
 * Icon-only for the same reason it is in a corner: the browser is already
 * saying this in words. The words live in the accessible name and an sr-only
 * line, where a screen reader needs them and a teacher mid-lesson does not.
 *
 * Portalled to `document.body` because `<main>` keeps a transform from
 * `animate-fade-in`'s `both` fill mode, which makes it the containing block for
 * anything fixed inside it — a bar rendered in place would be pinned to the
 * page column rather than the viewport. See `use-stage-fullscreen` for the same
 * problem found the hard way.
 */
export function SharingBar({
  share,
  hidden,
}: {
  share: ScreenShare;
  /** Fullscreen already carries these controls over the video. */
  hidden: boolean;
}) {
  if (!share.sharing || hidden) return null;

  return createPortal(
    <div
      className="fixed bottom-4 right-4 z-50 print:hidden"
      role="status"
      aria-live="off"
    >
      <div className="card flex items-center gap-1 rounded-full p-1 pl-3 shadow-card">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500 motion-safe:animate-pulse"
          aria-hidden="true"
        />
        {/* Carries the state for a screen reader without spending the width. */}
        <span className="sr-only">กำลังแชร์หน้าจออยู่</span>

        <button
          type="button"
          onClick={share.switchSource}
          disabled={share.pending}
          aria-label="เปลี่ยนหน้าจอ"
          title="เปลี่ยนหน้าจอ"
          className="ml-1 grid h-11 w-11 place-items-center rounded-full text-ink transition-colors hover:bg-black/[0.06] disabled:opacity-60"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={share.toggle}
          disabled={share.pending}
          aria-label="หยุดแชร์"
          title="หยุดแชร์"
          className="grid h-11 w-11 place-items-center rounded-full text-red-700 transition-colors hover:bg-red-500/10 disabled:opacity-60"
        >
          <MonitorX className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>,
    document.body
  );
}
