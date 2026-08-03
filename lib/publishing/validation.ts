import { z } from "zod";

const BANGKOK_UTC_OFFSET = "+07:00";
const WALL_CLOCK_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;

/**
 * Optional publish time shared by Announcement, Material and Assignment
 * (ADR-0046).
 *
 * Coerced rather than required to be a Date because it arrives from a form as
 * a string. Absent and null both mean "publish now", which is what every row
 * created before this feature means, so the field can be left out entirely.
 *
 * A time in the past is accepted and simply means now. Rejecting it would only
 * push teachers into fighting the clock over a distinction with no consequence:
 * either way the item is visible the moment it is saved.
 */
export const PublishAtSchema = z.coerce.date().nullish();

/**
 * Reads a publish time out of form data.
 *
 * `datetime-local` submits wall-clock text with no zone. Scheduling in Beagle
 * Classroom is a Bangkok wall-clock contract, so attach Bangkok's UTC offset
 * before constructing the instant. Leaving this to the server timezone makes
 * 08:30 become 15:30 when Vercel parses the value in UTC and the UI formats it
 * back in Asia/Bangkok. Explicitly-zoned ISO values remain unchanged.
 */
export function readPublishAt(raw: FormDataEntryValue | null): Date | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const instant = WALL_CLOCK_DATE_TIME.test(trimmed)
    ? `${trimmed}${BANGKOK_UTC_OFFSET}`
    : trimmed;
  const parsed = new Date(instant);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
