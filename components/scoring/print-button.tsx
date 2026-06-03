"use client";

import { Printer } from "lucide-react";

/**
 * Thin client wrapper around `window.print()` — kept as its own component
 * so the rest of `TermSummaryView` can stay a Server Component.
 *
 * Print styles live in `globals.css @media print`.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn-secondary btn-sm"
    >
      <Printer className="mr-1 inline h-3.5 w-3.5" />
      Print PDF
    </button>
  );
}
