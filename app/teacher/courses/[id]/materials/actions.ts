"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import {
  createMaterial,
  updateMaterial,
  softDeleteMaterial,
} from "@/lib/material";
import { getRequestMeta } from "@/lib/utils/request";
import { HttpError, ValidationError } from "@/lib/errors";

/**
 * Server Actions — Material list + detail (Phase 7 · P7-7).
 *
 * Pattern 6 (hidden form fields, no `.bind()`) + Pattern 8 (`"use server"`
 * = async exports only). Create / edit are Verbose tier (no audit per
 * CONTEXT § Material — "Edit เสรี · Verbose"). Delete fires
 * `MATERIAL_DELETED` Important via lib.
 *
 * `linkUrls` form input arrives as a single newline-separated string;
 * we split + trim + drop blanks at the edge so the schema sees a
 * clean array.
 */

function parseLinkUrls(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export type CreateMaterialState = {
  fieldErrors?: Record<string, string>;
  error?: string;
  ok?: boolean;
};

export async function createMaterialAction(
  _prev: CreateMaterialState,
  formData: FormData
): Promise<CreateMaterialState> {
  const session = await requireRole(["TEACHER"]);
  const meta = await getRequestMeta();

  const courseId = String(formData.get("courseId") ?? "");
  if (!courseId) return { error: "missing_course_id" };

  const title = String(formData.get("title") ?? "");
  const body = String(formData.get("body") ?? "");
  const linkUrls = parseLinkUrls(String(formData.get("linkUrls") ?? ""));

  try {
    await createMaterial(
      {
        courseOfferingId: courseId,
        title,
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

  revalidatePath(`/teacher/courses/${courseId}/materials`);
  return { ok: true };
}

export type UpdateMaterialState = CreateMaterialState;

export async function updateMaterialAction(
  _prev: UpdateMaterialState,
  formData: FormData
): Promise<UpdateMaterialState> {
  const session = await requireRole(["TEACHER"]);
  const meta = await getRequestMeta();

  const courseId = String(formData.get("courseId") ?? "");
  const materialId = String(formData.get("materialId") ?? "");
  if (!courseId || !materialId) return { error: "missing_ids" };

  const title = String(formData.get("title") ?? "");
  const body = String(formData.get("body") ?? "");
  const linkUrls = parseLinkUrls(String(formData.get("linkUrls") ?? ""));

  try {
    await updateMaterial(
      materialId,
      { title, body, linkUrls },
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

  revalidatePath(`/teacher/courses/${courseId}/materials`);
  revalidatePath(`/teacher/courses/${courseId}/materials/${materialId}`);
  return { ok: true };
}

export type DeleteMaterialState = CreateMaterialState;

export async function deleteMaterialAction(
  _prev: DeleteMaterialState,
  formData: FormData
): Promise<DeleteMaterialState> {
  const session = await requireRole(["TEACHER"]);
  const meta = await getRequestMeta();

  const courseId = String(formData.get("courseId") ?? "");
  const materialId = String(formData.get("materialId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  if (!courseId || !materialId) return { error: "missing_ids" };

  try {
    await softDeleteMaterial(materialId, {
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

  revalidatePath(`/teacher/courses/${courseId}/materials`);
  return { ok: true };
}
