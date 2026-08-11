import { z } from "zod";

export const MEETING_URL_MAX = 500;

/**
 * A link to an online classroom hosted elsewhere (ADR-0052).
 *
 * HTTPS only, unlike the general link fields on Announcements and Materials.
 * Those carry references a reader chooses to follow; this one is where a class
 * is told to go, and every provider a school would actually use serves HTTPS.
 * A plain-http meeting link in 2026 is a mistake, not a preference.
 */
export const MeetingUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(MEETING_URL_MAX)
  .refine(
    (value) => {
      try {
        return new URL(value).protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "ลิงก์ต้องขึ้นต้นด้วย https://" }
  );

/** Empty input means "no link", which is a normal state rather than an error. */
export const OptionalMeetingUrlSchema = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .refine(
    (value) => value === null || MeetingUrlSchema.safeParse(value).success,
    { message: "ลิงก์ต้องขึ้นต้นด้วย https://" }
  );
