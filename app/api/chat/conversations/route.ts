import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/guards";
import { openDirectConversation } from "@/lib/chat/direct-message";
import { errorResponse, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = await request.json().catch(() => null);
    const otherUserId =
      payload && typeof payload === "object" && "otherUserId" in payload
        ? String((payload as { otherUserId: unknown }).otherUserId).trim()
        : "";
    if (!otherUserId) {
      throw new ValidationError({ otherUserId: "ผู้รับไม่ถูกต้อง" });
    }
    const result = await openDirectConversation({
      otherUserId,
      ctx: { actorUserId: session.user.id },
    });
    return NextResponse.json(result, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const { status, body } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}
