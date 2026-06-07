"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import {
  createAnnouncement,
  updateAnnouncement,
  softDeleteAnnouncement,
} from "@/lib/announcement";
import { getRequestMeta } from "@/lib/utils/request";
import { HttpError, ValidationError } from "@/lib/errors";

/**
 * Server Actions — Announcement list + detail (Phase 7 · P7-7).
 *
 * Differs from Material: title is OPTIONAL (Announcement allows
 * untitled posts where the body itself is the announcement). Body is
 * REQUIRED (min 1) — opposite of Material where body is optional.
 *
 * Verbose tier for create/edit; `ANNOUNCEMENT_DELETED` Important audit
 * for soft-delete.
 */

function parseLinkUrls(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export type CreateAnnouncementState = {
  fieldErrors?: Record<string, string>;
  error?: string;
  ok?: boolean;
};

export async function createAnnouncementAction(
  _prev: CreateAnnouncementState,
  formData: FormData
): Promise<CreateAnnouncementState> {
  const session = await requireRole(["TEACHER"]);
  const meta = await getRequestMeta();

  const courseId = String(formData.get("courseId") ?? "");
  if (!courseId) return { error: "missing_course_id" };

  const titleRaw = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  const linkUrls = parseLinkUrls(String(formData.get("linkUrls") ?? ""));

  try {
    await createAnnouncement(
      {
        courseOfferingId: courseId,
        title: titleRaw || null,
        body,
        fileAttachmentIds: [],
        linkUrls,
      },
      {
        actorUserId: session.user.id,
        ipAddress: meta.ipAddress ?? undefined,
        userAgent: meta.userAgent ?? undefined,
      }
    );
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/teacher/courses/${courseId}/announcements`);
  return { ok: true };
}

export type UpdateAnnouncementState = CreateAnnouncementState;

export async function updateAnnouncementAction(
  _prev: UpdateAnnouncementState,
  formData: FormData
): Promise<UpdateAnnouncementState> {
  const session = await requireRole(["TEACHER"]);
  const meta = await getRequestMeta();

  const courseId = String(formData.get("courseId") ?? "");
  const announcementId = String(formData.get("announcementId") ?? "");
  if (!courseId || !announcementId) return { error: "missing_ids" };

  const titleRaw = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  const linkUrls = parseLinkUrls(String(formData.get("linkUrls") ?? ""));

  try {
    await updateAnnouncement(
      announcementId,
      { title: titleRaw || null, body, linkUrls },
      {
        actorUserId: session.user.id,
        ipAddress: meta.ipAddress ?? undefined,
        userAgent: meta.userAgent ?? undefined,
      }
    );
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/teacher/courses/${courseId}/announcements`);
  revalidatePath(
    `/teacher/courses/${courseId}/announcements/${announcementId}`
  );
  return { ok: true };
}

export type DeleteAnnouncementState = CreateAnnouncementState;

export async function deleteAnnouncementAction(
  _prev: DeleteAnnouncementState,
  formData: FormData
): Promise<DeleteAnnouncementState> {
  const session = await requireRole(["TEACHER"]);
  const meta = await getRequestMeta();

  const courseId = String(formData.get("courseId") ?? "");
  const announcementId = String(formData.get("announcementId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  if (!courseId || !announcementId) return { error: "missing_ids" };

  try {
    await softDeleteAnnouncement(announcementId, {
      actorUserId: session.user.id,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
      reason,
    });
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/teacher/courses/${courseId}/announcements`);
  return { ok: true };
}
