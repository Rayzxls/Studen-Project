import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { markNotificationRead } from "@/lib/notification";
import { errorResponse } from "@/lib/errors";

/**
 * POST /api/notification/[id]/read — Phase 7 · P7-4
 *
 * Marks a single notification as read. Recipient-scoped: a user can
 * never mark another user's row (the WHERE clause inside
 * `markNotificationRead` enforces `recipientId = session.user.id`).
 *
 * Q10 = A — click on a bell row fires this, then navigates.
 * Verbose tier — no audit (Pattern 10 + Q10.4 lock).
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const affected = await markNotificationRead({
      notificationId: id,
      recipientId: session.user.id,
    });
    return NextResponse.json({ ok: true, affected });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
