"use server";

import type {
  ModerationReportCategory,
  ModerationTargetType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/guards";
import { HttpError, ValidationError } from "@/lib/errors";
import {
  appealModerationCase,
  createModerationReport,
} from "@/lib/moderation/service";

export type ReportContentActionState = {
  ok?: boolean;
  duplicate?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const TARGET_TYPES = new Set<ModerationTargetType>([
  "COMMENT",
  "ANNOUNCEMENT",
  "MATERIAL",
  "ASSIGNMENT",
  "FILE_ATTACHMENT",
  "PROFILE_IMAGE",
]);

const CATEGORIES = new Set<ModerationReportCategory>([
  "HARASSMENT",
  "INAPPROPRIATE_CONTENT",
  "PRIVACY",
  "COPYRIGHT",
  "SPAM",
  "OTHER",
]);

export async function reportContentAction(
  _previous: ReportContentActionState,
  formData: FormData
): Promise<ReportContentActionState> {
  const session = await requireAuth();
  const targetType = String(formData.get("targetType") ?? "").trim();
  const targetId = String(formData.get("targetId") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const details = String(formData.get("details") ?? "");

  if (!TARGET_TYPES.has(targetType as ModerationTargetType) || !targetId) {
    return { error: "moderation_target_invalid" };
  }
  if (!CATEGORIES.has(category as ModerationReportCategory)) {
    return {
      fieldErrors: { category: "moderation_category_invalid" },
    };
  }

  try {
    const result = await createModerationReport({
      actor: { userId: session.user.id, role: session.user.role },
      targetType: targetType as ModerationTargetType,
      targetId,
      category: category as ModerationReportCategory,
      details,
    });
    return { ok: true, duplicate: result.duplicate };
  } catch (error) {
    if (error instanceof ValidationError) {
      return { error: error.code, fieldErrors: error.errors };
    }
    if (error instanceof HttpError) return { error: error.code };
    throw error;
  }
}

export type AppealModerationActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function appealModerationAction(
  _previous: AppealModerationActionState,
  formData: FormData
): Promise<AppealModerationActionState> {
  const session = await requireAuth();
  const caseId = String(formData.get("caseId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "");
  if (!caseId) return { error: "moderation_case_invalid" };

  try {
    await appealModerationCase({
      actor: { userId: session.user.id, role: session.user.role },
      caseId,
      reason,
    });
    revalidatePath("/moderation");
    revalidatePath("/admin/moderation");
    return { ok: true };
  } catch (error) {
    if (error instanceof ValidationError) {
      return { error: error.code, fieldErrors: error.errors };
    }
    if (error instanceof HttpError) return { error: error.code };
    throw error;
  }
}
