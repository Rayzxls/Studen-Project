import { z } from "zod";

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
 * `datetime-local` submits wall-clock text with no zone, which the Date
 * constructor reads in the server's zone. That is what the teacher meant — they
 * picked a time on a clock, not an instant in UTC — so it is parsed as-is
 * rather than being reinterpreted.
 */
export function readPublishAt(raw: FormDataEntryValue | null): Date | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
