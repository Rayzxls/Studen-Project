import {
  colorsForSlot,
  getCourseSlot,
  type CourseSlot,
} from "@/lib/theme/course-color";

/**
 * CourseColorChip — three variants of the per-class identity colour.
 *
 * Role-modulated rendering (ADR-0028 § 8):
 *  - `chip`   : full coloured pill with the label. Student feed, dashboard.
 *  - `marker` : 4px left bar with no label. Teacher list rows.
 *  - `dot`    : small filled circle. Admin list rows where space is tight.
 *
 * Pass either `classId` (deterministic hash) or an explicit `slot` if the
 * caller has already resolved one. `label` is optional and only renders on
 * the `chip` variant.
 */
export interface CourseColorChipProps {
  classId?: string;
  slot?: CourseSlot;
  variant?: "chip" | "marker" | "dot";
  label?: string;
  className?: string;
}

export function CourseColorChip({
  classId,
  slot: explicitSlot,
  variant = "chip",
  label,
  className,
}: CourseColorChipProps) {
  const slot =
    explicitSlot ?? (classId ? getCourseSlot(classId) : (0 as CourseSlot));
  const c = colorsForSlot(slot);

  if (variant === "marker") {
    return (
      <span
        aria-hidden
        className={className}
        style={{
          display: "inline-block",
          width: 4,
          minHeight: "1em",
          alignSelf: "stretch",
          borderRadius: 9999,
          background: c.bg,
        }}
      />
    );
  }

  if (variant === "dot") {
    return (
      <span
        aria-hidden
        className={className}
        style={{
          display: "inline-block",
          width: 10,
          height: 10,
          borderRadius: 9999,
          background: c.bg,
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" +
        (className ? " " + className : "")
      }
      style={{
        background: c.bgTinted,
        color: c.text,
      }}
    >
      {label}
    </span>
  );
}
