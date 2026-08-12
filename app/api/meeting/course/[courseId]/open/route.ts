import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/guards";
import { errorResponse } from "@/lib/errors";
import { openRoomNow } from "@/lib/meeting/open-now";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ courseId: string }>;
}

/**
 * POST /api/meeting/course/[courseId]/open — start the class in one press.
 *
 * A route rather than only a Server Action because the teacher expects to land
 * in Meet, and a tab opened after an awaited action is a popup as far as the
 * browser is concerned. The client opens the tab on the click and fills in the
 * destination this returns.
 *
 * Ownership is checked inside — twice, in findOrCreateSession and again in
 * openRoom — so a teacher who does not own the course gets Forbidden before
 * anything is created.
 */
export async function POST(_request: Request, { params }: RouteProps) {
  try {
    const session = await requireRole(["TEACHER"]);
    const { courseId } = await params;

    const opened = await openRoomNow({
      courseOfferingId: courseId,
      actorUserId: session.user.id,
    });

    return NextResponse.json(opened, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
