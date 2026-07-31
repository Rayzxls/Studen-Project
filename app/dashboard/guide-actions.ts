"use server";

import { requireAuth } from "@/lib/auth/guards";
import { isTourId, markTourSeen } from "@/lib/guide/completion";
import type { TourId } from "@/lib/guide/tours";

/**
 * Marks a walkthrough as seen for the signed-in person.
 *
 * Shared by every surface that shows a tour rather than duplicated per route.
 * The subject is always the session user, so nobody can mark a tour on someone
 * else's behalf, and an unknown tour id is ignored rather than stored — the id
 * arrives from the client, so it is not trusted.
 */
export async function markGuideTourSeenAction(tourId: TourId): Promise<void> {
  const session = await requireAuth();
  if (!isTourId(tourId)) return;
  await markTourSeen({ userId: session.user.id, tourId });
}
