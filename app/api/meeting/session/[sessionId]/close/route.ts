import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/guards";
import { errorResponse } from "@/lib/errors";
import { closeRoom } from "@/lib/meeting/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ sessionId: string }>;
}

/**
 * POST /api/meeting/session/[sessionId]/close — end the room for everyone.
 *
 * The counterpart to `open`, and the teacher's alone: `closeRoom` checks course
 * ownership rather than membership, because ending a class is not something a
 * student in it may do.
 *
 * Different from leaving. Leaving is one person stepping out of a room that
 * carries on; this shuts the room, and every browser still in it discovers that
 * on its next poll and falls back to the closed state.
 *
 * Idempotent, so a second press is a slip rather than an error.
 */
export async function POST(_request: Request, { params }: RouteProps) {
  try {
    const session = await requireAuth();
    const { sessionId } = await params;

    const { closedAt } = await closeRoom({
      sessionId,
      actorUserId: session.user.id,
    });

    return NextResponse.json(
      { closedAt },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
