"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import {
  createAssignment,
  deleteAssignment,
  updateAssignment,
} from "@/lib/assignment/assignment";
import { getRequestMeta } from "@/lib/utils/request";
import { HttpError, ValidationError } from "@/lib/errors";

/**
 * Server Actions — Assignment list page (Phase 6 · P6-5a).
 *
 * Pattern 6 (hidden form fields, no `.bind()`) + Pattern 8 (`"use server"`
 * = async exports only). createAssignment lib lives in lib/assignment/assignment.ts
 * and handles the ADR-0019 atomic ScoreItem coupling.
 */

export type CreateAssignmentState = {
  fieldErrors?: Record<string, string>;
  error?: string;
  ok?: boolean;
};

export type AssignmentMutationState = CreateAssignmentState;

export async function createAssignmentAction(
  _prev: CreateAssignmentState,
  formData: FormData
): Promise<CreateAssignmentState> {
  const session = await requireRole(["TEACHER"]);
  const meta = await getRequestMeta();

  const courseId = String(formData.get("courseId") ?? "");
  if (!courseId) return { error: "missing_course_id" };

  const title = String(formData.get("title") ?? "");
  const description = String(formData.get("description") ?? "");
  const dueAtStr = String(formData.get("dueAt") ?? "");
  const allowText = formData.get("allowText") === "on";
  const allowFile = formData.get("allowFile") === "on";
  const allowLink = formData.get("allowLink") === "on";
  const autoCloseAtDue = formData.get("autoCloseAtDue") === "on";
  const isScored = formData.get("isScored") === "on";
  const fullScoreRaw = String(formData.get("fullScore") ?? "");

  // ADR-0024 — no weight field anymore; only fullScore when isScored.
  let fullScore: number | undefined;
  if (isScored) {
    fullScore = Number.parseInt(fullScoreRaw, 10);
    if (!Number.isInteger(fullScore) || fullScore <= 0) {
      return { fieldErrors: { fullScore: "ระบุคะแนนเต็มเป็นจำนวนเต็มบวก" } };
    }
  }

  try {
    await createAssignment(
      {
        courseOfferingId: courseId,
        title,
        description,
        dueAt: dueAtStr ? new Date(dueAtStr) : null,
        allowText,
        allowFile,
        allowLink,
        submissionClosed: false,
        autoCloseAtDue,
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

  revalidatePath(`/teacher/courses/${courseId}/assignments`);
  return { ok: true };
}

export async function updateAssignmentAction(
  _prev: AssignmentMutationState,
  formData: FormData
): Promise<AssignmentMutationState> {
  const session = await requireRole(["TEACHER"]);
  const meta = await getRequestMeta();

  const courseId = String(formData.get("courseId") ?? "");
  const assignmentId = String(formData.get("assignmentId") ?? "");
  if (!courseId) return { error: "missing_course_id" };
  if (!assignmentId) return { error: "missing_assignment_id" };

  const title = String(formData.get("title") ?? "");
  const description = String(formData.get("description") ?? "");
  const dueAtRaw = String(formData.get("dueAt") ?? "");
  const allowText = formData.get("allowText") === "on";
  const allowFile = formData.get("allowFile") === "on";
  const allowLink = formData.get("allowLink") === "on";
  const submissionClosed = formData.get("submissionClosed") === "on";
  const autoCloseAtDue = formData.get("autoCloseAtDue") === "on";
  const isScored = formData.get("isScored") === "on";
  const wasScored = formData.get("wasScored") === "true";

  if (!allowText && !allowFile && !allowLink) {
    return {
      fieldErrors: {
        allowText: "ต้องอนุญาตอย่างน้อย 1 ช่องทาง (ข้อความ / ไฟล์ / ลิงก์)",
      },
    };
  }

  const patch: Parameters<typeof updateAssignment>[1] = {
    title,
    description,
    dueAt: dueAtRaw ? new Date(dueAtRaw) : null,
    allowText,
    allowFile,
    allowLink,
    submissionClosed,
    autoCloseAtDue,
    isScored,
  };

  if (!wasScored && isScored) {
    const fullScore = Number.parseInt(
      String(formData.get("fullScore") ?? ""),
      10
    );
    if (!Number.isInteger(fullScore) || fullScore <= 0) {
      return { fieldErrors: { fullScore: "ระบุคะแนนเต็มเป็นจำนวนเต็มบวก" } };
    }
    patch.fullScore = fullScore;
  }

  try {
    await updateAssignment(assignmentId, patch, {
      actorUserId: session.user.id,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/teacher/courses/${courseId}/assignments`);
  revalidatePath(`/teacher/courses/${courseId}/assignments/${assignmentId}`);
  return { ok: true };
}

export async function deleteAssignmentAction(
  _prev: AssignmentMutationState,
  formData: FormData
): Promise<AssignmentMutationState> {
  const session = await requireRole(["TEACHER"]);
  const meta = await getRequestMeta();

  const courseId = String(formData.get("courseId") ?? "");
  const assignmentId = String(formData.get("assignmentId") ?? "");
  if (!courseId) return { error: "missing_course_id" };
  if (!assignmentId) return { error: "missing_assignment_id" };

  try {
    await deleteAssignment(assignmentId, {
      actorUserId: session.user.id,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
  } catch (err) {
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/teacher/courses/${courseId}/assignments`);
  return { ok: true };
}
