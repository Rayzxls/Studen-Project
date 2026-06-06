"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { getRequestMeta } from "@/lib/utils/request";
import { createAssignment } from "@/lib/assignment/assignment";
import { createMaterial } from "@/lib/material/material";
import { createAnnouncement } from "@/lib/announcement/announcement";
import { HttpError, ValidationError } from "@/lib/errors";

/**
 * Unified composer Server Actions — Phase 10C · ADR-0025 § 3.
 *
 * One server action per content type. The composer dialog (client)
 * routes to the appropriate action based on the chip selection. Each
 * action follows Pattern 6 (hidden form fields + no .bind()) and
 * Pattern 8 ("use server" async exports only).
 */

interface BaseState {
  fieldErrors?: Record<string, string>;
  error?: string;
  ok?: boolean;
}

/** Newline-separated link textarea → trimmed non-empty list (mirrors the
 *  announcement/material list-page composers). URL shape is validated in
 *  the create lib's Zod schema (LinkUrlSchema). */
function parseLinkUrls(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export type ComposeAnnouncementState = BaseState;

export async function composeAnnouncementAction(
  _prev: ComposeAnnouncementState,
  formData: FormData
): Promise<ComposeAnnouncementState> {
  const session = await requireRole(["TEACHER"]);
  const meta = await getRequestMeta();
  const courseId = String(formData.get("courseId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const linkUrls = parseLinkUrls(String(formData.get("linkUrls") ?? ""));
  if (!courseId) return { error: "missing_course_id" };
  if (body.length === 0) {
    return { fieldErrors: { body: "ระบุเนื้อหาประกาศ" } };
  }
  try {
    await createAnnouncement(
      {
        courseOfferingId: courseId,
        title: title.length === 0 ? null : title,
        body,
        linkUrls,
        fileAttachmentIds: [],
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
  revalidatePath(`/teacher/courses/${courseId}/feed`);
  return { ok: true };
}

export type ComposeAssignmentState = BaseState;

export async function composeAssignmentAction(
  _prev: ComposeAssignmentState,
  formData: FormData
): Promise<ComposeAssignmentState> {
  const session = await requireRole(["TEACHER"]);
  const meta = await getRequestMeta();
  const courseId = String(formData.get("courseId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "");
  const dueAtStr = String(formData.get("dueAt") ?? "");
  const isScored = formData.get("isScored") === "on";
  const fullScoreRaw = String(formData.get("fullScore") ?? "");
  if (!courseId) return { error: "missing_course_id" };
  if (title.length === 0) {
    return { fieldErrors: { title: "ตั้งชื่อการบ้าน" } };
  }
  let fullScore: number | undefined;
  if (isScored) {
    fullScore = Number.parseInt(fullScoreRaw, 10);
    if (!Number.isInteger(fullScore) || fullScore <= 0) {
      return { fieldErrors: { fullScore: "ระบุคะแนนเต็ม (จำนวนเต็มบวก)" } };
    }
  }
  try {
    await createAssignment(
      {
        courseOfferingId: courseId,
        title,
        description,
        dueAt: dueAtStr ? new Date(dueAtStr) : null,
        allowText: true,
        allowFile: true,
        allowLink: true,
        submissionClosed: false,
        autoCloseAtDue: false,
        isScored,
        fullScore,
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
  revalidatePath(`/teacher/courses/${courseId}/feed`);
  return { ok: true };
}

export type ComposeMaterialState = BaseState;

export async function composeMaterialAction(
  _prev: ComposeMaterialState,
  formData: FormData
): Promise<ComposeMaterialState> {
  const session = await requireRole(["TEACHER"]);
  const meta = await getRequestMeta();
  const courseId = String(formData.get("courseId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const linkUrls = parseLinkUrls(String(formData.get("linkUrls") ?? ""));
  if (!courseId) return { error: "missing_course_id" };
  if (title.length === 0) {
    return { fieldErrors: { title: "ตั้งชื่อเอกสาร" } };
  }
  try {
    await createMaterial(
      {
        courseOfferingId: courseId,
        title,
        body,
        linkUrls,
        fileAttachmentIds: [],
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
  revalidatePath(`/teacher/courses/${courseId}/feed`);
  return { ok: true };
}
