import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/guards";
import { errorResponse } from "@/lib/errors";
import { getRoomState } from "@/lib/meeting/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ courseId: string }>;
}

/**
 * GET /api/meeting/course/[courseId]/state — what the room poll asks (ADR-0053).
 *
 * Called every few seconds by anyone with the course open, because Vercel
 * functions cannot hold a WebSocket and "immediate" is worth a few seconds of
 * staleness rather than a second piece of infrastructure.
 *
 * Cheap by construction: one indexed lookup for the open session and its
 * presence rows. The three states are derived from timestamps at read time, so
 * nothing writes on a poll and a tab that dies needs no sweeper.
 *
 * Never cached. A cached answer here means a student is told the room is shut
 * while the class is running.
 */
export async function GET(_request: Request, { params }: RouteProps) {
  try {
    const session = await requireAuth();
    const { courseId } = await params;

    // Membership is checked inside getRoomState, which throws Forbidden for a
    // non-member rather than returning an empty room — an empty room and "not
    // your course" must not look the same to a caller probing course ids.
    const state = await getRoomState({
      courseOfferingId: courseId,
      actorUserId: session.user.id,
    });

    return NextResponse.json(state, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
