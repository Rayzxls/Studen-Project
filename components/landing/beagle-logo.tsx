import Image from "next/image";

/**
 * BeagleLogo — Beagle Classroom brand mark (Phase 12).
 *
 * Uses the real generated logo (cropped + background made transparent,
 * stored at /brand/beagle-mark.png). The wordmark text is typeset in our
 * own font rather than baked into an image, so the spelling stays crisp
 * at every size and the lockup matches the app typography.
 */
export function BeagleLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/beagle-mark.png"
      alt="Beagle Classroom"
      width={464}
      height={483}
      className={className}
      priority
    />
  );
}

/** Wordmark lockup — real icon + typeset "Beagle Classroom". */
export function BeagleWordmark({
  className,
  textClassName,
}: {
  className?: string;
  textClassName?: string;
}) {
  return (
    <span className={"inline-flex items-center gap-2 " + (className ?? "")}>
      <BeagleLogo className="h-8 w-auto object-contain" />
      <span
        className={"text-xl font-semibold text-black " + (textClassName ?? "")}
        style={{ letterSpacing: "-0.03em" }}
      >
        Beagle <span className="text-blue-600">Classroom</span>
      </span>
    </span>
  );
}
