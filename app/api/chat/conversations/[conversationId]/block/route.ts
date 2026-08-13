import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/guards";
import { setDirectMessageBlock } from "@/lib/chat/direct-message";
import { errorResponse, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ conversationId: string }>;
}

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const session = await requireAuth();
    const { conversationId } = await params;
    const payload = await request.json().catch(() => null);
    const blocked =
      payload && typeof payload === "object" && "blocked" in payload
        ? (payload as { blocked: unknown }).blocked
        : null;
    if (typeof blocked !== "boolean") {
      throw new ValidationError({ blocked: "สถานะการบล็อกไม่ถูกต้อง" });
    }
    const result = await setDirectMessageBlock({
      conversationId,
      blocked,
      ctx: { actorUserId: session.user.id },
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const { status, body } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}
