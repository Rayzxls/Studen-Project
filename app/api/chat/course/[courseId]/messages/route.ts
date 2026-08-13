import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/auth/rate-limit";
import { requireAuth } from "@/lib/auth/guards";
import {
  listCourseChannelMessages,
  sendCourseChannelMessage,
} from "@/lib/chat/course-channel";
import { errorResponse, TooManyRequests, ValidationError } from "@/lib/errors";
import { sendCourseChatPush } from "@/lib/notification/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ courseId: string }>;
}

/** Focused tabs poll this endpoint; membership is rechecked on every request. */
export async function GET(request: Request, { params }: RouteProps) {
  try {
    const session = await requireAuth();
    const { courseId } = await params;
    const afterMessageId = new URL(request.url).searchParams
      .get("after")
      ?.trim();
    const result = await listCourseChannelMessages({
      courseOfferingId: courseId,
      afterMessageId: afterMessageId || undefined,
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

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const session = await requireAuth();
    const { courseId } = await params;
    const payload = await readPayload(request);
    const limit = await rateLimit({
      key: `chat:send:${session.user.id}`,
      max: 30,
      windowSec: 60,
      lockoutSec: 30,
    });
    if (!limit.allowed) {
      throw new TooManyRequests("chat_send_rate_limited", 30);
    }

    const message = await sendCourseChannelMessage({
      courseOfferingId: courseId,
      body: payload.body,
      ctx: { actorUserId: session.user.id },
    });
    const senderName = message.author
      ? [message.author.firstName, message.author.lastName]
          .filter((part): part is string => Boolean(part?.trim()))
          .join(" ")
          .trim() || "สมาชิก"
      : "สมาชิก";
    await sendCourseChatPush({
      courseOfferingId: courseId,
      senderId: session.user.id,
      senderName,
      messageBody: message.body ?? "ข้อความใหม่",
    });
    return NextResponse.json(message, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const { status, body } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}

async function readPayload(request: Request): Promise<{ body: string }> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new ValidationError({ body: "รูปแบบคำขอไม่ถูกต้อง" });
  }
  if (!payload || typeof payload !== "object" || !("body" in payload)) {
    throw new ValidationError({ body: "กรุณาพิมพ์ข้อความ" });
  }
  const body = (payload as { body?: unknown }).body;
  if (typeof body !== "string") {
    throw new ValidationError({ body: "กรุณาพิมพ์ข้อความ" });
  }
  return { body };
}
