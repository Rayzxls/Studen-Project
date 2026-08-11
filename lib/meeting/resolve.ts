/**
 * Which online room a given period meets in (ADR-0052).
 *
 * The course carries a standing link because a teacher's room is usually the
 * same all term. A TimetableSlot may override it, which is what a course whose
 * lecture and lab meet in different places needs.
 *
 * Pure, so the rule can be read and tested in one place instead of being
 * rebuilt at every call site that renders a period.
 */

export interface MeetingLinkSource {
  /** The period's own link, when it has one. */
  slotMeetingUrl?: string | null;
  /** The course's standing link. */
  courseMeetingUrl?: string | null;
}

export type MeetingLinkOrigin = "SLOT" | "COURSE";

export interface ResolvedMeetingLink {
  url: string;
  /** Where the link came from, so the UI can say "ใช้ลิงก์ประจำวิชา". */
  origin: MeetingLinkOrigin;
}

export function resolveMeetingLink(
  source: MeetingLinkSource
): ResolvedMeetingLink | null {
  const slot = normalise(source.slotMeetingUrl);
  if (slot !== null) return { url: slot, origin: "SLOT" };

  const course = normalise(source.courseMeetingUrl);
  if (course !== null) return { url: course, origin: "COURSE" };

  return null;
}

/**
 * Treats blank as absent. A column that has ever been edited through a form can
 * hold an empty string, and an empty string is not a link.
 */
function normalise(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
