/**
 * Display formatters for scoring — Phase 5 · Phase 10 cutover.
 *
 * PURE — server/client safe, no Prisma, no I/O.
 *
 * ADR-0024 removed `formatBasisPoints` along with the `weight` channel.
 * Score Item influence is now read directly from `fullScore` — surfaces
 * render the integer as-is or via `formatPercent` for derived ratios.
 */

/**
 * Format a percent value (0..100) for grade UI: 2 decimals, trailing
 * zeros trimmed.
 *
 *   73.5  → "73.5%"
 *   80    → "80%"
 *   null  → "—"
 */
export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const fixed = value.toFixed(2);
  const trimmed = fixed.replace(/\.?0+$/, "");
  return `${trimmed}%`;
}

/**
 * Format a Term GPA value with exactly 2 decimals, or "—" when null.
 *
 *   3.752 → "3.75"
 *   4     → "4.00"
 *   null  → "—"
 *
 * Always 2 decimals (no trim) — Thai school transcripts show "4.00",
 * not "4". This is the contract `/student/terms` renders.
 */
export function formatGpa(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}
