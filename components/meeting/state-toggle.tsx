"use client";

import type { ReactNode } from "react";

/**
 * A device toggle that shows its state, not its verb.
 *
 * Green is on and red is off, the way every call application does it, so the
 * bar can be read at a glance mid-lesson without parsing words. The label says
 * the state for the same reason; what pressing will do lives in the accessible
 * name, where a screen reader needs it and a glance does not.
 *
 * Both colours come from themed tokens, so the bar survives all four themes —
 * a literal green would go on being bright green on the dark surface.
 */
export function StateToggle({
  on,
  disabled,
  onClick,
  onLabel,
  offLabel,
  actionLabel,
  icon,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  onLabel: string;
  offLabel: string;
  actionLabel: string;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      aria-label={actionLabel}
      title={actionLabel}
      className={
        "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors disabled:opacity-60 " +
        (on
          ? "border-green-500/25 bg-green-50 text-green-700 hover:bg-green-500/10"
          : "border-red-500/25 bg-red-50 text-red-700 hover:bg-red-500/10")
      }
    >
      {icon}
      {on ? onLabel : offLabel}
    </button>
  );
}
