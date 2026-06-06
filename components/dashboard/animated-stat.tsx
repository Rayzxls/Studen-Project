"use client";

import { useCountUp, formatCountUp } from "@/lib/hooks/use-count-up";

/**
 * AnimatedStat — renders an integer KPI value that counts up from 0 on
 * mount via the useCountUp rAF hook. Respects prefers-reduced-motion
 * (snaps to target) and SSR (returns target immediately on first paint).
 *
 * Pairs with .stat-value or any heading where the static number used to
 * appear. The wrapping element controls font size + colour; this client
 * leaf is just the text.
 */
export interface AnimatedStatProps {
  /** Final integer value to count up to. */
  value: number;
  /** Animation duration. Defaults to 600ms per ADR-0028 § 6 spring-large. */
  duration?: number;
  /** Optional suffix rendered after the formatted number ("%", "นาที"). */
  suffix?: string;
}

export function AnimatedStat({
  value,
  duration = 600,
  suffix,
}: AnimatedStatProps) {
  const current = useCountUp(value, { duration });
  return (
    <>
      {formatCountUp(current)}
      {suffix ? <span className="ml-1">{suffix}</span> : null}
    </>
  );
}
