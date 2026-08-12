import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth/guards";
import { errorResponse, ValidationError } from "@/lib/errors";
import { heartbeat } from "@/lib/meeting/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ sessionId: string }>;
}

const HeartbeatSchema = z.object({
  /**
   * Whether the tab was frontmost when this beat was sent. The whole
   * difference between the green dot and the hollow one, and the reason an
   * unfocused tab must keep beating rather than go quiet: silence means the
   * laptop is shut, not that someone looked away.
   */
  focused: z.boolean(),
});

/**
 * POST /api/meeting/session/[sessionId]/heartbeat — a tab saying it is still there.
 *
 * The client sends this on the same cadence as the poll. It never creates a
 * presence row: only pressing Join does that, so a tab left open on a course
 * page does not put someone in a room they never entered.
 */
export async function POST(request: Request, { params }: RouteProps) {
  try {
    const session = await requireAuth();
    const { sessionId } = await params;

    const parsed = HeartbeatSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new ValidationError({ focused: "ต้องระบุสถานะหน้าต่าง" });
    }

    await heartbeat({
      sessionId,
      actorUserId: session.user.id,
      focused: parsed.data.focused,
    });

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
