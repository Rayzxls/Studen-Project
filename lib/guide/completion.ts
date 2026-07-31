import { db } from "@/lib/db/client";
import { TOUR_IDS, type TourId } from "./tours";

/** Narrows an untrusted string to a tour id, so a client cannot invent one. */
export function isTourId(value: string): value is TourId {
  return (TOUR_IDS as readonly string[]).includes(value);
}

/**
 * Whether this person still has the given walkthrough waiting for them.
 *
 * `eligible` is the caller's own condition for the tour being meaningful at all
 * — a student with no enrolment has nothing to be shown around. It is checked
 * first so an ineligible visit does not consume the tour.
 */
export async function shouldShowTour(input: {
  userId: string;
  tourId: TourId;
  eligible: boolean;
}): Promise<boolean> {
  if (!input.eligible) return false;

  const seen = await db.guideTourCompletion.findUnique({
    where: { userId_tourId: { userId: input.userId, tourId: input.tourId } },
    select: { tourId: true },
  });
  return seen === null;
}

/**
 * Forgets every walkthrough this person has finished, so the tours run again
 * from the start on their next visit to each surface.
 *
 * Exists because a tour is otherwise a one-shot: without this, seeing it a
 * second time — to check a change, or simply because the person wants the
 * reminder — would mean a new account.
 */
export async function resetToursForUser(userId: string): Promise<number> {
  const { count } = await db.guideTourCompletion.deleteMany({
    where: { userId },
  });
  return count;
}

/**
 * Records that a walkthrough is done. Idempotent, so finishing it in two open
 * tabs keeps the first timestamp rather than moving it.
 */
export async function markTourSeen(input: {
  userId: string;
  tourId: TourId;
}): Promise<void> {
  await db.guideTourCompletion.upsert({
    where: { userId_tourId: { userId: input.userId, tourId: input.tourId } },
    create: { userId: input.userId, tourId: input.tourId },
    update: {},
  });
}
