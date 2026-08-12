import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/guards";
import { errorResponse } from "@/lib/errors";
import { joinRoom } from "@/lib/meeting/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ sessionId: string }>;
}

/**
 * POST /api/meeting/session/[sessionId]/join — record the press, return where to go.
 *
 * POST rather than a redirect that a link could point at directly, even though
 * a redirect would dodge popup blockers: a GET that writes is a GET a prefetch
 * or a link scanner can fire, and this one would put people in rooms they
 * never opened. The caller opens the tab on the click and fills in the
 * destination when this resolves.
 *
 * What is recorded is the press, not attendance. The student leaves for Meet
 * and nothing comes back, so this is as much as anything downstream may claim
 * (ADR-0052, ADR-0053).
 */
export async function POST(_request: Request, { params }: RouteProps) {
  try {
    const session = await requireAuth();
    const { sessionId } = await params;

    const { meetingUrl } = await joinRoom({
      sessionId,
      actorUserId: session.user.id,
    });

    return NextResponse.json(
      { meetingUrl },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
