"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ReactNode,
} from "react";

/**
 * BottomSheet — thin wrapper around native `<dialog>` that opts in to the
 * `.sheet` mobile bottom-sheet variant (ADR-0028 § 7 + Pattern 7).
 *
 * Desktop (≥ 768px): renders as a centered modal — same shape as the
 * existing per-feature dialogs in the codebase (Pattern 7).
 *
 * Mobile (< 768px): the `.sheet` class in globals.css repositions the
 * dialog to the bottom edge, applies a slide-up animation via
 * --spring-large, and blurs the backdrop. CSS-only — no JS branching.
 *
 * Existing dialogs do NOT need to migrate to this wrapper. They can opt
 * in by simply adding `sheet` to their `className`:
 *
 *   <dialog ref={dialogRef} className="... sheet">...</dialog>
 *
 * The wrapper exists for greenfield dialogs that want the imperative
 * `open()` / `close()` API plus the sheet class baked in.
 *
 * Pattern 7 deferred-close discipline (Phase 3 hotfix for Next 16 +
 * React 19 + Turbopack) is preserved — call `close()` from a setTimeout
 * after success state propagates, exactly as existing dialogs do.
 */

export interface BottomSheetHandle {
  open: () => void;
  close: () => void;
}

export interface BottomSheetProps {
  /** Additional class names appended to `sheet ...` */
  className?: string;
  /** Defaults match the existing Pattern 7 centered-modal shape. */
  width?: string;
  /** Render prop receives the dialog's close fn for use in cancel buttons. */
  children: ReactNode | ((close: () => void) => ReactNode);
  /** Optional callback fired when the dialog closes (after close()). */
  onClose?: () => void;
}

export const BottomSheet = forwardRef<BottomSheetHandle, BottomSheetProps>(
  function BottomSheet(
    { className, width = "w-[calc(100%-2rem)] max-w-md", children, onClose },
    ref
  ) {
    const dialogRef = useRef<HTMLDialogElement | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        open: () => dialogRef.current?.showModal(),
        close: () => {
          const d = dialogRef.current;
          if (!d) return;
          d.close();
          d.removeAttribute("open");
        },
      }),
      []
    );

    useEffect(() => {
      const d = dialogRef.current;
      if (!d || !onClose) return;
      const handler = () => onClose();
      d.addEventListener("close", handler);
      return () => d.removeEventListener("close", handler);
    }, [onClose]);

    const close = () => {
      const d = dialogRef.current;
      if (!d) return;
      d.close();
      d.removeAttribute("open");
    };

    return (
      <dialog
        ref={dialogRef}
        className={[
          "sheet",
          "fixed inset-0 m-auto h-fit rounded-2xl border border-black/10 bg-white p-0 shadow-soft backdrop:bg-black/40",
          width,
          className ?? "",
        ]
          .join(" ")
          .trim()}
      >
        {typeof children === "function" ? children(close) : children}
      </dialog>
    );
  }
);
