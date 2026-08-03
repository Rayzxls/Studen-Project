import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

const FLUSH_TIMEOUT_MS = 2_000;

/**
 * Sends a controlled, secret-protected server event to Sentry.
 *
 * This is intentionally a POST and reuses the scheduler credential so it can
 * be called from an operator process without creating another Production
 * secret. The global Sentry beforeSend hook removes the Authorization header,
 * cookies, request body, signed URL credentials, and user details before any
 * event leaves the process.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.SENTRY_DSN?.trim()) {
    return NextResponse.json(
      { error: "sentry_not_configured" },
      { status: 503 }
    );
  }

  const eventId = Sentry.captureException(
    new Error("beagle_controlled_sentry_probe"),
    {
      tags: {
        probe: "controlled",
        source: "production_acceptance",
      },
    }
  );
  const delivered = await Sentry.flush(FLUSH_TIMEOUT_MS);

  if (!delivered) {
    return NextResponse.json(
      { error: "sentry_delivery_unconfirmed", eventId },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, eventId });
}
