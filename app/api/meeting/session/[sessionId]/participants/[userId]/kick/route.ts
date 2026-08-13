import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/guards";
import { errorResponse } from "@/lib/errors";
import { kickParticipant } from "@/lib/meeting/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ sessionId: string; userId: string }>;
}

/**
 * Remove one student from the live room without changing enrolment or
 * attendance. Course ownership is checked by the service; hiding the control
 * from students is only presentation, never authorization.
 */
export async function POST(_request: Request, { params }: RouteProps) {
  try {
    const session = await requireAuth();
    const { sessionId, userId } = await params;

    await kickParticipant({
      sessionId,
      actorUserId: session.user.id,
      targetUserId: userId,
    });

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const { status, body } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}
