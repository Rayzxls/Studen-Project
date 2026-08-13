import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/guards";
import { errorResponse } from "@/lib/errors";
import { leaveRoom } from "@/lib/meeting/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ sessionId: string }>;
}

/**
 * POST /api/meeting/session/[sessionId]/leave — step out of the room.
 *
 * POST for the same reason join is: a GET that writes is a GET that a prefetch
 * or a link scanner can fire, and this one would walk people out of rooms they
 * are sitting in.
 *
 * Leaving is not a record of absence any more than joining was a record of
 * attendance (ADR-0052). All it does is stop the room drawing someone who is no
 * longer looking at it.
 */
export async function POST(_request: Request, { params }: RouteProps) {
  try {
    const session = await requireAuth();
    const { sessionId } = await params;

    await leaveRoom({ sessionId, actorUserId: session.user.id });

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
