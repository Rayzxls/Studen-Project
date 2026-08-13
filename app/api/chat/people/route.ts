import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/guards";
import { searchChatPeople } from "@/lib/chat/direct-message";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const query = new URL(request.url).searchParams.get("q") ?? "";
    const people = await searchChatPeople({
      query,
      ctx: { actorUserId: session.user.id },
    });
    return NextResponse.json(
      { people },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const { status, body } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}
