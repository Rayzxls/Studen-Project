"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  X,
} from "lucide-react";

/**
 * Focus mode for the student Assignments page — Phase 12 "งาน cockpit" ·
 * phase 2. A distraction-free overlay that steps through pending work one
 * item at a time (a to-do "queue"), so a student can plough through the list
 * without the whole page competing for attention.
 *
 * Client component: it owns the open/index state and keyboard nav (← → to
 * move, Esc to close). The parent passes plain, already-ordered items across
 * the RSC boundary.
 */

export type FocusItem = {
  id: string;
  title: string;
  href: string;
  dueLabel: string;
  statusLabel: string;
  statusClass: string;
  note: string | null;
};

export function FocusMode({ items }: { items: FocusItem[] }) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  const count = items.length;
  const clamp = useCallback(
    (n: number) => Math.min(Math.max(n, 0), count - 1),
    [count]
  );

  const close = useCallback(() => setOpen(false), []);
  const next = useCallback(() => setIdx((i) => clamp(i + 1)), [clamp]);
  const prev = useCallback(() => setIdx((i) => clamp(i - 1)), [clamp]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close, next, prev]);

  if (count === 0) return null;

  const item = items[clamp(idx)]!;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIdx(0);
          setOpen(true);
        }}
        className="flex min-h-11 w-full items-center gap-3 rounded-2xl bg-black/[0.03] px-4 py-3 text-left transition-colors hover:bg-black/[0.05]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
          <Crosshair className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-black">
            เข้าโหมดโฟกัส
          </span>
          <span className="block text-xs text-black/50">
            ทำงานทีละชิ้น · {count} งานค้าง
          </span>
        </span>
        <ArrowRight
          className="h-4 w-4 shrink-0 text-black/40"
          aria-hidden="true"
        />
      </button>

      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="โหมดโฟกัส"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <button
              type="button"
              aria-label="ปิดโหมดโฟกัส"
              onClick={close}
              className="absolute inset-0 bg-black/40"
              style={{ backdropFilter: "blur(4px)" }}
            />
            <div className="relative z-10 w-full max-w-md animate-slide-up rounded-3xl bg-surface p-6 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-black/50">
                  งานที่ {clamp(idx) + 1} จาก {count}
                </span>
                <button
                  type="button"
                  onClick={close}
                  aria-label="ปิด"
                  className="grid h-9 w-9 place-items-center rounded-full text-black/50 transition-colors hover:bg-black/5 hover:text-black"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              {/* progress dots */}
              <div className="mt-3 flex gap-1">
                {items.map((it, i) => (
                  <span
                    key={it.id}
                    className={
                      "h-1 flex-1 rounded-full " +
                      (i === clamp(idx)
                        ? "bg-blue-500"
                        : i < clamp(idx)
                          ? "bg-blue-500/40"
                          : "bg-black/10")
                    }
                  />
                ))}
              </div>

              <div className="mt-6">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${item.statusClass}`}
                >
                  {item.statusLabel}
                </span>
                <h2
                  className="mt-3 text-xl font-semibold text-black"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {item.title}
                </h2>
                <p className="mt-1.5 text-sm text-black/55">{item.dueLabel}</p>
                {item.note && (
                  <p className="mt-1 text-xs text-black/50">{item.note}</p>
                )}
              </div>

              <Link
                href={item.href}
                className="group mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-blue-500 px-5 text-sm font-medium text-white transition-colors hover:bg-blue-600 hover:no-underline"
              >
                เปิดงานนี้
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>

              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={prev}
                  disabled={clamp(idx) === 0}
                  className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-medium text-black/60 transition-colors hover:bg-black/5 disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  ก่อนหน้า
                </button>
                <button
                  type="button"
                  onClick={next}
                  disabled={clamp(idx) === count - 1}
                  className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-medium text-black/60 transition-colors hover:bg-black/5 disabled:opacity-30"
                >
                  ถัดไป
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
