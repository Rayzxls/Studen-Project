import { NextResponse } from "next/server";
import { assert, requireAuth } from "@/lib/auth/guards";
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
    const row = await db.assignment.findUnique({
      where: { id: ownerId },
      select: {
        courseOfferingId: true,
        course: { select: { teacherId: true } },
      },
    });
    if (!row) throw new NotFound("assignment_not_found");
    await assertCanReadCourseFile(row.courseOfferingId, row.course.teacherId);
    return;
  }
  if (ownerType === "MATERIAL") {
    const row = await db.material.findUnique({
      where: { id: ownerId },
      select: {
        courseOfferingId: true,
        course: { select: { teacherId: true } },
      },
    });
    if (!row) throw new NotFound("material_not_found");
    await assertCanReadCourseFile(row.courseOfferingId, row.course.teacherId);
    return;
  }
  if (ownerType === "ANNOUNCEMENT") {
    const row = await db.announcement.findUnique({
      where: { id: ownerId },
      select: {
        courseOfferingId: true,
        course: { select: { teacherId: true } },
      },
    });
    if (!row) throw new NotFound("announcement_not_found");
    await assertCanReadCourseFile(row.courseOfferingId, row.course.teacherId);
    return;
  }
  throw new Forbidden("file_owner_type_not_readable");
}

async function assertCanReadCourseFile(
  courseOfferingId: string,
  teacherId: string
): Promise<void> {
  const session = await requireAuth();
  if (session.user.role === "ADMIN") return;
  if (session.user.role === "TEACHER" && session.user.id === teacherId) return;
  if (session.user.role === "STUDENT") {
    const enrollment = await db.enrollment.findUnique({
      where: {
        studentId_courseOfferingId: {
          studentId: session.user.id,
          courseOfferingId,
        },
      },
      select: { removedAt: true, course: { select: { archivedAt: true } } },
    });
    if (
      enrollment?.removedAt === null &&
      enrollment.course.archivedAt === null
    ) {
      return;
    }
  }
  throw new Forbidden();
}

function isInlinePreviewMime(mimeType: string): boolean {
  return mimeType === "application/pdf" || mimeType.startsWith("image/");
}
