import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/guards";
import { errorResponse, ValidationError } from "@/lib/errors";
import { mintStageToken, readLiveKitConfig } from "@/lib/meeting/livekit";
import { stageAccessFor } from "@/lib/meeting/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ sessionId: string }>;
}

/**
 * POST /api/meeting/session/[sessionId]/stage-token — the key to the stage.
 *
 * Minted per request and never stored. The permission check is the same one
 * that guards the meeting link: active enrolment or the owning teacher, and a
 * room that is actually open. A student removed from the course stops being
 * able to mint one in the same breath as losing the course.
 *
 * The token itself carries the publish right, so a student who edits the page
 * still cannot put anything on the stage — the server decided, not the button.
 *
 * Never cached, for the obvious reason.
 */
export async function POST(_request: Request, { params }: RouteProps) {
  try {
    const session = await requireAuth();
    const { sessionId } = await params;

    const config = readLiveKitConfig();
    if (!config) {
      // Not an error the user caused: the stage simply is not configured.
      throw new ValidationError({ stage: "ยังไม่ได้เปิดใช้งานหน้าจอในห้อง" });
    }

    const access = await stageAccessFor({
      sessionId,
      actorUserId: session.user.id,
    });

    const token = await mintStageToken(
      {
        sessionId,
        userId: session.user.id,
        participantName: access.participantName,
        canPresent: access.canPresent,
      },
      config
    );

    return NextResponse.json(
      { token, url: config.url, canPresent: access.canPresent },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
