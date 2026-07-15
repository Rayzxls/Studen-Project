import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { Forbidden, NotFound, errorResponse } from "@/lib/errors";
import { isModerationEvidenceFile } from "@/lib/moderation/evidence";
import { moderationCenterEnabled } from "@/lib/moderation/feature-flags";
import { buildContentDisposition } from "@/lib/storage/keys";
import {
  isLocalStorageFallbackEnabled,
  readLocalObject,
} from "@/lib/storage/local-dev";
import { signDownloadUrl, SIGNED_URL_TTL_SEC } from "@/lib/storage/sign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ caseId: string; fileId: string }>;
}

/**
 * Streams an immutable moderation evidence file to an Admin reviewer.
 * Authorization is deliberately scoped to the case snapshot: knowing a file
 * id alone is insufficient, and the object never becomes publicly readable.
 */
export async function GET(_request: Request, { params }: RouteProps) {
  try {
    await requireRole(["ADMIN"]);
    if (!moderationCenterEnabled()) {
      throw new Forbidden("moderation_center_disabled");
    }

    const { caseId, fileId } = await params;
    const moderationCase = await db.moderationCase.findUnique({
      where: { id: caseId },
      select: { targetSnapshot: true },
    });
    if (!moderationCase) throw new NotFound("moderation_case_not_found");

    if (!isModerationEvidenceFile(moderationCase.targetSnapshot, fileId)) {
      throw new NotFound("moderation_evidence_not_found");
    }

    // Keep soft-deleted rows reviewable: the immutable case snapshot is the
    // source of authorization, and moderation evidence must survive removal
    // from normal teaching surfaces.
    const file = await db.fileAttachment.findUnique({
      where: { id: fileId },
      select: {
        r2Key: true,
        originalFilename: true,
        mimeType: true,
      },
    });
    if (!file) throw new NotFound("moderation_evidence_not_found");

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
    const response = NextResponse.redirect(signedUrl);
    response.headers.set(
      "cache-control",
      `private, max-age=${SIGNED_URL_TTL_SEC}`
    );
    return response;
  } catch (error) {
    const { status, body } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}

function isInlinePreviewMime(mimeType: string): boolean {
  return mimeType === "application/pdf" || mimeType.startsWith("image/");
}
