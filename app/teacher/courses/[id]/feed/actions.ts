"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { getRequestMeta } from "@/lib/utils/request";
import { createAssignment } from "@/lib/assignment/assignment";
import { createMaterial } from "@/lib/material/material";
import { createAnnouncement } from "@/lib/announcement/announcement";
import { ZodError } from "zod";
import { HttpError, ValidationError } from "@/lib/errors";
import { lessonWorkspaceCourseMutationsEnabled } from "@/lib/lesson";

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

/** Map a Zod issue tree to the composer's `fieldErrors` shape so a bad
 *  input (e.g. a malformed link) surfaces inline instead of throwing an
 *  uncaught ZodError that 500s the page. */
function zodToFieldErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path[0] != null ? String(issue.path[0]) : "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

function parseFileAttachmentIds(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || raw.trim().length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(
          (id): id is string => typeof id === "string" && id.length > 0
        )
      : [];
  } catch {
    return [];
  }
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
  const ownerId = String(formData.get("ownerId") ?? "").trim();
  const fileAttachmentIds = parseFileAttachmentIds(
    formData.get("fileAttachmentIds")
  );
  if (!courseId) return { error: "missing_course_id" };
  if (fileAttachmentIds.length > 0 && ownerId.length === 0) {
    return {
      fieldErrors: { fileAttachmentIds: "missing_attachment_owner_id" },
    };
  }
  if (body.length === 0) {
    return { fieldErrors: { body: "ระบุเนื้อหาประกาศ" } };
  }
  try {
    await createAnnouncement(
      {
        courseOfferingId: courseId,
        id: ownerId.length > 0 ? ownerId : undefined,
        title: title.length === 0 ? null : title,
        body,
        linkUrls,
        fileAttachmentIds,
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
    if (err instanceof ZodError) return { fieldErrors: zodToFieldErrors(err) };
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
  const lessonId = String(formData.get("lessonId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "");
  const dueAtStr = String(formData.get("dueAt") ?? "");
  const isScored = formData.get("isScored") === "on";
  const fullScoreRaw = String(formData.get("fullScore") ?? "");
  const linkUrls = parseLinkUrls(String(formData.get("linkUrls") ?? ""));
  const ownerId = String(formData.get("ownerId") ?? "").trim();
  const fileAttachmentIds = parseFileAttachmentIds(
    formData.get("fileAttachmentIds")
  );
  if (!courseId) return { error: "missing_course_id" };
  if (
    lessonWorkspaceCourseMutationsEnabled(courseId) &&
    lessonId.length === 0
  ) {
    return { fieldErrors: { lessonId: "เลือกบทเรียนก่อนสร้างการบ้าน" } };
  }
  if (fileAttachmentIds.length > 0 && ownerId.length === 0) {
    return {
      fieldErrors: { fileAttachmentIds: "missing_attachment_owner_id" },
    };
  }
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
        lessonId: lessonId.length > 0 ? lessonId : null,
        id: ownerId.length > 0 ? ownerId : undefined,
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
        linkUrls,
        fileAttachmentIds,
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
    if (err instanceof ZodError) return { fieldErrors: zodToFieldErrors(err) };
    throw err;
  }
  revalidatePath(`/teacher/courses/${courseId}/feed`);
  if (lessonId)
    revalidatePath(`/teacher/courses/${courseId}/lessons/${lessonId}`);
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
  const lessonId = String(formData.get("lessonId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const linkUrls = parseLinkUrls(String(formData.get("linkUrls") ?? ""));
  const ownerId = String(formData.get("ownerId") ?? "").trim();
  const fileAttachmentIds = parseFileAttachmentIds(
    formData.get("fileAttachmentIds")
  );
  if (!courseId) return { error: "missing_course_id" };
  if (
    lessonWorkspaceCourseMutationsEnabled(courseId) &&
    lessonId.length === 0
  ) {
    return { fieldErrors: { lessonId: "เลือกบทเรียนก่อนสร้างเอกสาร" } };
  }
  if (fileAttachmentIds.length > 0 && ownerId.length === 0) {
    return {
      fieldErrors: { fileAttachmentIds: "missing_attachment_owner_id" },
    };
  }
  if (title.length === 0) {
    return { fieldErrors: { title: "ตั้งชื่อเอกสาร" } };
  }
  try {
    await createMaterial(
      {
        courseOfferingId: courseId,
        lessonId: lessonId.length > 0 ? lessonId : null,
        id: ownerId.length > 0 ? ownerId : undefined,
        title,
        body,
        linkUrls,
        fileAttachmentIds,
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
    if (err instanceof ZodError) return { fieldErrors: zodToFieldErrors(err) };
    throw err;
  }
  revalidatePath(`/teacher/courses/${courseId}/feed`);
  if (lessonId)
    revalidatePath(`/teacher/courses/${courseId}/lessons/${lessonId}`);
  return { ok: true };
}
