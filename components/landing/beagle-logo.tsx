/**
 * BeagleLogo — temporary brand mark for Beagle Classroom (Phase 12).
 *
 * A friendly beagle head (round eyes, the signature long drop ears)
 * wearing a small graduation cap — the family story (beagle lovers +
 * ครู/ข้าราชการครู) folded into one geometric mark. System Blue cap +
 * warm tan ears, on the brand ink for the face line. Swap for the
 * AI-generated logo when ready; the API (className) stays the same.
 *
 * Pure SVG, currentColor-free (uses explicit brand tokens) so it reads
 * correctly on both light and dark surfaces.
 */
export function BeagleLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="Beagle Classroom"
      fill="none"
    >
      {/* drop ears — beagle signature, warm tan */}
      <path
        d="M14 20c-5 0-8 4-8 9 0 4 2 7 5 8 2-6 4-11 6-15-1-1-2-2-3-2Z"
        fill="#E8A646"
      />
      <path
        d="M34 20c5 0 8 4 8 9 0 4-2 7-5 8-2-6-4-11-6-15 1-1 2-2 3-2Z"
        fill="#E8A646"
      />
      {/* face — cream */}
      <path
        d="M24 14c7 0 12 5 12 13 0 7-5 12-12 12s-12-5-12-12c0-8 5-13 12-13Z"
        fill="#FDF6E8"
        stroke="#0F172A"
        strokeWidth="2"
      />
      {/* eyes — round friendly */}
      <circle cx="19.5" cy="27" r="2.3" fill="#0F172A" />
      <circle cx="28.5" cy="27" r="2.3" fill="#0F172A" />
      <circle cx="20.2" cy="26.3" r="0.7" fill="#fff" />
      <circle cx="29.2" cy="26.3" r="0.7" fill="#fff" />
      {/* snout + nose */}
      <ellipse cx="24" cy="33.5" rx="4.2" ry="3" fill="#fff" />
      <circle cx="24" cy="32" r="1.8" fill="#0F172A" />
      {/* graduation cap — System Blue */}
      <path d="M24 6 8 12l16 6 16-6-16-6Z" fill="#0A84FF" />
      <path d="M24 18l16-6v1l-16 6-16-6v-1l16 6Z" fill="#0070EB" />
      {/* tassel */}
      <path
        d="M40 12v6"
        stroke="#0070EB"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="40" cy="19" r="1.4" fill="#E8A646" />
    </svg>
  );
}

/** Wordmark lockup — icon + "Beagle Classroom" text. */
export function BeagleWordmark({
  className,
  textClassName,
}: {
  className?: string;
  textClassName?: string;
}) {
  return (
    <span className={"inline-flex items-center gap-2 " + (className ?? "")}>
      <BeagleLogo className="h-8 w-8" />
      <span
        className={"text-xl font-semibold text-black " + (textClassName ?? "")}
        style={{ letterSpacing: "-0.03em" }}
      >
        Beagle <span className="text-blue-600">Classroom</span>
      </span>
    </span>
  );
}
