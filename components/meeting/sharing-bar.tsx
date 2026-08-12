"use client";

import { createPortal } from "react-dom";
import { MonitorX, RefreshCw } from "lucide-react";

import type { ScreenShare } from "@/components/meeting/use-screen-share";

/**
 * A standing reminder that you are sharing, and the two things you might want
 * to do about it (ADR-0053).
 *
 * Discord keeps this in front of you for a reason: a share is the one control
 * in a call whose consequence continues after you have stopped thinking about
 * it, and the room page is not where a teacher spends the lesson. Scrolling to
 * the roster or moving to another tab of the course should not mean hunting for
 * the way to stop.
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
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 print:hidden"
      role="status"
    >
      <div className="card pointer-events-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-full py-2 pl-4 pr-2 shadow-card">
        <span className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500 motion-safe:animate-pulse"
            aria-hidden="true"
          />
          <span className="text-sm font-medium text-ink">
            กำลังแชร์หน้าจออยู่
          </span>
        </span>

        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={share.switchSource}
            disabled={share.pending}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-hairline-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-black/[0.04] disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            เปลี่ยนหน้าจอ
          </button>

          <button
            type="button"
            onClick={share.toggle}
            disabled={share.pending}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-red-500/25 bg-red-50 px-4 text-sm font-medium text-red-700 transition-colors hover:bg-red-500/10 disabled:opacity-60"
          >
            <MonitorX className="h-4 w-4" aria-hidden="true" />
            หยุดแชร์
          </button>
        </span>
      </div>
    </div>,
    document.body
  );
}
