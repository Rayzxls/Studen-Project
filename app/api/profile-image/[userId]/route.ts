import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { buildContentDisposition } from "@/lib/storage/keys";
import { signDownloadUrl } from "@/lib/storage/sign";
import {
  isLocalStorageFallbackEnabled,
  readLocalObject,
} from "@/lib/storage/local-dev";
import { errorResponse } from "@/lib/errors";

/**
 * GET /api/profile-image/[userId] — Phase 13 avatar serving.
 *
 * Profile images are never public R2 URLs (CLAUDE.md hard rule): every
 * request passes the auth gate here first, then receives a 302 to a
 * 5-minute signed R2 URL (or the local-dev bytes directly).
 *
 * Permission model: avatars are identity info at the same level as the
 * display of a person's name — every authenticated user may load them
 * (students already see peer names in rosters and class-wide comments).
 * No role check beyond "logged in".
 */

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireAuth();
    const { userId } = await params;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { profileImageId: true },
    });
    if (!user?.profileImageId) {
      // No custom avatar — fall back to the shared default asset.
      return NextResponse.redirect(
        new URL("/images/default-avatar.png", req.url),
        { status: 302 }
      );
    }

    const file = await db.fileAttachment.findUnique({
      where: { id: user.profileImageId },
      select: { r2Key: true, mimeType: true, deletedAt: true },
    });
    if (!file || file.deletedAt) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (isLocalStorageFallbackEnabled()) {
      const bytes = await readLocalObject(file.r2Key);
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "content-type": file.mimeType,
          "cache-control": "private, max-age=300",
        },
      });
    }

    const url = await signDownloadUrl({
      permanentKey: file.r2Key,
      contentDisposition: buildContentDisposition({
        filename: "avatar.jpg",
        disposition: "inline",
      }),
    });
    return NextResponse.redirect(url, {
      status: 302,
      headers: { "cache-control": "private, max-age=240" },
    });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
