import { NextResponse } from "next/server";

import { publishDueContent } from "@/lib/publishing/sweep";

/**
 * Fans out notifications for content whose publish time has passed
 * (ADR-0046).
 *
 * Nothing here decides what a student can see — visibility is a comparison
 * against the clock in every read path, so this endpoint being late, blocked or
 * never called delays a notification and nothing else.
 *
 * Protected by a shared secret rather than a session: the caller is a
 * scheduler, not a person. Without `CRON_SECRET` configured the endpoint
 * refuses every request, so an unconfigured deployment cannot be swept by a
 * stranger who guesses the path.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  }

  const provided = request.headers.get("authorization");
  if (provided !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await publishDueContent();
  return NextResponse.json({ ok: true, ...result });
}
