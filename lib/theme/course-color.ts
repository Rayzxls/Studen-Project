/**
 * Course Identity Colour — ADR-0028 § 2
 *
 * Resolves a stable colour slot (0..7) per Class via a deterministic hash of
 * the class id. Phase 11 ships hash-derived only; admin override via a
 * Class.colorSlot column is deferred to Phase 13.
 *
 * Each slot exposes three surfaces:
 *  - `bg` (`-500`) — saturated chip surface, marker stripe, dot indicator
 *  - `bgTinted` (`-50`) — soft callout, inline list-row background
 *  - `text` (`-700`-equivalent dark) — text on tinted bg with WCAG AA contrast
 *
 * The gradient mesh function returns a CSS `background` value composed from
 * three radial-gradient layers — used as the banner zone of `.card-hero`.
 * Phase 11D may swap to photographic WebP backgrounds while keeping this API.
 */

export const COURSE_SLOT_COUNT = 8;

export type CourseSlot = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type CourseSlotName =
  | "rose"
  | "coral"
  | "amber"
  | "lime"
  | "teal"
  | "sky"
  | "indigo"
  | "violet";

export interface CourseSlotColors {
  slot: CourseSlot;
  name: CourseSlotName;
  /** Saturated -500 — chip, marker, dot, dark-text on tinted */
  bg: string;
  /** Tinted -50 — callout bg, hero info bar bg */
  bgTinted: string;
  /** Dark variant for text on tinted bg (WCAG AA verified at body size) */
  text: string;
}

const SLOT_TABLE: Record<CourseSlot, CourseSlotColors> = {
  0: {
    slot: 0,
    name: "rose",
    bg: "#f56c7c",
    bgTinted: "#fef1f3",
    text: "#9f1239",
  },
  1: {
    slot: 1,
    name: "coral",
    bg: "#f58e6e",
    bgTinted: "#fef3ee",
    text: "#9a3412",
  },
  2: {
    slot: 2,
    name: "amber",
    bg: "#e8a646",
    bgTinted: "#fdf6e8",
    text: "#854d0e",
  },
  3: {
    slot: 3,
    name: "lime",
    bg: "#94c944",
    bgTinted: "#f2faea",
    text: "#3f6212",
  },
  4: {
    slot: 4,
    name: "teal",
    bg: "#3cb4ac",
    bgTinted: "#ebfaf8",
    text: "#115e59",
  },
  5: {
    slot: 5,
    name: "sky",
    bg: "#5eaedb",
    bgTinted: "#eef7fc",
    text: "#075985",
  },
  6: {
    slot: 6,
    name: "indigo",
    bg: "#7a7ae5",
    bgTinted: "#eff0fe",
    text: "#3730a3",
  },
  7: {
    slot: 7,
    name: "violet",
    bg: "#b574d6",
    bgTinted: "#f8eefb",
    text: "#6b21a8",
  },
};

/**
 * djb2 hash — small, fast, deterministic. Stable across deploys; sufficient
 * for distributing N classes across 8 slots without runtime cost.
 */
function hashStringToSlot(input: string): CourseSlot {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  const positive = h < 0 ? -h : h;
  return (positive % COURSE_SLOT_COUNT) as CourseSlot;
}

/** Resolve a class id to its colour slot. */
export function getCourseSlot(classId: string): CourseSlot {
  return hashStringToSlot(classId);
}

/** Resolve a class id directly to its full colour surfaces. */
export function getCourseSlotColors(classId: string): CourseSlotColors {
  return SLOT_TABLE[getCourseSlot(classId)];
}

/** Look up colour surfaces by an already-resolved slot. */
export function colorsForSlot(slot: CourseSlot): CourseSlotColors {
  return SLOT_TABLE[slot];
}

/**
 * Gradient mesh — three radial-gradient layers composed into a single CSS
 * `background` value. Used as the banner zone of `.card-hero` until Phase 11D
 * or later commissions a photographic asset set.
 */
export function getCourseSlotGradient(slot: CourseSlot): string {
  const c = SLOT_TABLE[slot];
  // Three offset radial gradients, each fading into the next, plus a soft
  // base wash. The result reads as a tonal mesh rather than a flat tint.
  return [
    `radial-gradient(circle at 20% 20%, ${c.bg} 0%, transparent 60%)`,
    `radial-gradient(circle at 80% 30%, ${c.bgTinted} 0%, transparent 55%)`,
    `radial-gradient(circle at 50% 90%, ${c.bg} 0%, transparent 70%)`,
    c.bgTinted,
  ].join(", ");
}

/** Resolve gradient mesh directly from a class id. */
export function getCourseGradientForClass(classId: string): string {
  return getCourseSlotGradient(getCourseSlot(classId));
}
