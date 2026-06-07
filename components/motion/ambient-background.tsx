/**
 * AmbientBackground — slowly drifting gradient blobs behind a hero
 * surface (ADR-0029 § 2, T1/T2). Pure CSS; renders as an absolutely
 * positioned decoration layer. Caller positions it inside a `relative
 * overflow-hidden` parent.
 *
 * Server Component (no client JS) — the drift is a CSS @keyframes
 * animation defined in globals.css (`blob-drift-a/b/c`), so it runs
 * without hydration and is suppressed by the global reduced-motion block.
 *
 * `tone` picks the blob palette; pass a system colour ("blue" | "green" |
 * "orange" | "red") or "neutral". The blobs sit at low opacity so text
 * over them keeps contrast.
 */
export interface AmbientBackgroundProps {
  tone?: "blue" | "green" | "orange" | "red" | "neutral";
  /** Blob opacity 0..1. Default 0.5. Lower for text-heavy surfaces. */
  intensity?: number;
}

const TONE_COLORS: Record<
  NonNullable<AmbientBackgroundProps["tone"]>,
  [string, string, string]
> = {
  blue: ["#0a84ff", "#5eaedb", "#7fc1ff"],
  green: ["#34c759", "#94c944", "#3cb4ac"],
  orange: ["#ff9500", "#f58e6e", "#e8a646"],
  red: ["#ff3b30", "#f56c7c", "#f58e6e"],
  neutral: ["#c7c7d1", "#d4d4dd", "#e2e2ea"],
};

export function AmbientBackground({
  tone = "blue",
  intensity = 0.5,
}: AmbientBackgroundProps) {
  const [a, b, c] = TONE_COLORS[tone];
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ opacity: intensity }}
    >
      <span className="ambient-blob ambient-blob-a" style={{ background: a }} />
      <span className="ambient-blob ambient-blob-b" style={{ background: b }} />
      <span className="ambient-blob ambient-blob-c" style={{ background: c }} />
    </div>
  );
}
