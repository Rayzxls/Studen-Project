import { NextResponse } from "next/server";

import { expireChatMessages } from "@/lib/chat/retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await expireChatMessages();
  return NextResponse.json({
    ok: true,
    ...result,
    checkedAt: new Date().toISOString(),
  });
}
