import { NextResponse } from "next/server";
import { assert } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { Forbidden, NotFound, errorResponse } from "@/lib/errors";
import {
  buildContentDisposition,
  type FileOwnerTypeLiteral,
} from "@/lib/storage/keys";
import {
  isLocalStorageFallbackEnabled,
  readLocalObject,
} from "@/lib/storage/local-dev";
import { signDownloadUrl, SIGNED_URL_TTL_SEC } from "@/lib/storage/sign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ fileId: string }>;
}

export async function GET(_req: Request, { params }: RouteProps) {
  try {
    const { fileId } = await params;
    const file = await db.fileAttachment.findFirst({
      where: { id: fileId, deletedAt: null },
      select: {
        id: true,
        r2Key: true,
        ownerType: true,
        ownerId: true,
        originalFilename: true,
        mimeType: true,
      },
    });
    if (!file) throw new NotFound("file_not_found");

    await assertCanReadFile(file.ownerType, file.ownerId);

    const disposition = buildContentDisposition({
      filename: file.originalFilename,
      disposition: isInlinePreviewMime(file.mimeType) ? "inline" : "attachment",
    });

    if (isLocalStorageFallbackEnabled()) {
      const bytes = await readLocalObject(file.r2Key);
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "content-type": file.mimeType,
          "content-length": String(bytes.length),
          "content-disposition": disposition,
          "cache-control": "private, no-store",
        },
      });
    }

    const signedUrl = await signDownloadUrl({
      permanentKey: file.r2Key,
      contentDisposition: disposition,
    });
    const res = NextResponse.redirect(signedUrl);
    res.headers.set("cache-control", `private, max-age=${SIGNED_URL_TTL_SEC}`);
    return res;
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

async function assertCanReadFile(
  ownerType: FileOwnerTypeLiteral,
  ownerId: string
): Promise<void> {
  if (ownerType === "SUBMISSION") {
    await assert.canViewSubmission(ownerId);
    return;
  }
  if (ownerType === "ASSIGNMENT") {
    await assert.canMutateAssignment(ownerId);
    return;
  }
  throw new Forbidden("file_owner_type_not_readable");
}

function isInlinePreviewMime(mimeType: string): boolean {
  return mimeType === "application/pdf" || mimeType.startsWith("image/");
}
