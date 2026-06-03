/**
 * Display formatters for scoring — Phase 5.
 *
 * PURE — server/client safe, no Prisma, no I/O.
 *
 * The basis-points → percent conversion lives in exactly one place per
 * ADR-0017 § Decision 1. Every UI surface that renders a `weight` must
 * call `formatBasisPoints()` rather than dividing inline.
 */

/**
 * Format integer basis points (0..10000) as a "%" string.
 *
 *   3333  → "33.33%"
 *   5000  → "50%"
 *   10000 → "100%"
 *   3330  → "33.3%"   (trailing zero trimmed)
 *   0     → "0%"
 *
 * NaN / non-finite → "—" (so UI renders the dash placeholder).
 */
export function formatBasisPoints(bp: number): string {
  if (!Number.isFinite(bp)) return "—";
  const percent = bp / 100;
  const fixed = percent.toFixed(2);
  // Strip ".00" entirely or one trailing zero: "33.30" → "33.3", "50.00" → "50".
  const trimmed = fixed.replace(/\.?0+$/, "");
  return `${trimmed}%`;
}

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
