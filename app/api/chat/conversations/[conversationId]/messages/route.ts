import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/auth/rate-limit";
import {
  listDirectMessages,
  sendDirectMessage,
} from "@/lib/chat/direct-message";
import { errorResponse, TooManyRequests, ValidationError } from "@/lib/errors";
import { sendChatPushToUsers } from "@/lib/notification/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ conversationId: string }>;
}

export async function GET(request: Request, { params }: RouteProps) {
  try {
    const session = await requireAuth();
    const { conversationId } = await params;
    const afterMessageId = new URL(request.url).searchParams
      .get("after")
      ?.trim();
    const messages = await listDirectMessages({
      conversationId,
      afterMessageId: afterMessageId || undefined,
      ctx: { actorUserId: session.user.id },
    });
    return NextResponse.json(
      { conversationId, messages },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const { status, body } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const session = await requireAuth();
    const { conversationId } = await params;
    const payload = await request.json().catch(() => null);
    const body =
      payload && typeof payload === "object" && "body" in payload
        ? (payload as { body: unknown }).body
        : null;
    if (typeof body !== "string") {
      throw new ValidationError({ body: "กรุณาพิมพ์ข้อความ" });
    }
    const limit = await rateLimit({
      key: `chat:send:${session.user.id}`,
      max: 30,
      windowSec: 60,
      lockoutSec: 30,
    });
    if (!limit.allowed) throw new TooManyRequests("chat_send_rate_limited", 30);
    const result = await sendDirectMessage({
      conversationId,
      body,
      ctx: { actorUserId: session.user.id },
    });
    const senderName = result.message.author
      ? [result.message.author.firstName, result.message.author.lastName]
          .filter((part): part is string => Boolean(part?.trim()))
          .join(" ")
          .trim() || "สมาชิก"
      : "สมาชิก";
    await sendChatPushToUsers([result.recipientId], {
      senderName,
      messageBody: result.message.body ?? "ข้อความใหม่",
      url: `/chat/${conversationId}`,
      tag: `chat-direct-${conversationId}`,
    });
    return NextResponse.json(result.message, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const { status, body } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}
