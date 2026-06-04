import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { markAllNotificationsRead } from "@/lib/notification";
import { errorResponse } from "@/lib/errors";

/**
 * POST /api/notification/read-all — Phase 7 · P7-4
 *
 * Bulk-marks every unread + non-suppressed notification for the
 * authenticated user as read. Q10.1 = A — global scope across all
 * courses, no per-course filter.
 *
 * Verbose tier — no audit (Pattern 10 + Q10.4 lock).
 */
export async function POST() {
  try {
    const session = await requireAuth();
    const count = await markAllNotificationsRead(session.user.id);
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
