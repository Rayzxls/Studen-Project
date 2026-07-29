"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { getRequestMeta } from "@/lib/utils/request";
import { removeProfileImage } from "@/lib/profile/mutations";
import { HttpError } from "@/lib/errors";
import { suspendOrReactivateAccount } from "@/lib/account/lifecycle-service";
import { createPrismaAccountLifecycleRepository } from "@/lib/account/prisma-repository";

export interface ResetProfileImageState {
  error?: string;
  ok?: boolean;
}

/**
 * Admin clears another user's avatar (moderation — back to default).
 * Audits PROFILE_IMAGE_RESET_BY_ADMIN via lib/profile.removeProfileImage.
 */
export async function resetProfileImageAction(
  _prev: ResetProfileImageState,
  formData: FormData
): Promise<ResetProfileImageState> {
  const session = await requireRole(["ADMIN"]);
  const meta = await getRequestMeta();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "missing_user_id" };
  try {
    await removeProfileImage(
      { targetUserId: userId },
      {
        actorUserId: session.user.id,
        actorRole: session.user.role,
        ipAddress: meta.ipAddress ?? undefined,
        userAgent: meta.userAgent ?? undefined,
      }
    );
    revalidatePath(`/admin/users/${userId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }
}

export interface AccountLifecycleActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: boolean;
  status?: "ACTIVE" | "SUSPENDED";
}

export async function changeAccountStatusAction(
  _prev: AccountLifecycleActionState,
  formData: FormData
): Promise<AccountLifecycleActionState> {
  const session = await requireRole(["ADMIN"]);
  const targetUserId = String(formData.get("userId") ?? "").trim();
  const to = String(formData.get("to") ?? "").trim();
  const internalReason = String(formData.get("internalReason") ?? "");
  const userMessage = String(formData.get("userMessage") ?? "");
  const confirmed = formData.get("confirmed") === "yes";

  if (!targetUserId) return { error: "missing_user_id" };
  if (to !== "ACTIVE" && to !== "SUSPENDED") {
    return { error: "account_lifecycle_transition_invalid" };
  }
  if (!confirmed) return { error: "account_lifecycle_confirmation_required" };

  try {
    await suspendOrReactivateAccount(
      {
        actor: { userId: session.user.id, role: session.user.role },
        targetUserId,
        to,
        internalReason,
        userMessage,
      },
      { repository: createPrismaAccountLifecycleRepository() }
    );

    revalidatePath(`/admin/users/${targetUserId}`);
    revalidatePath("/admin/teachers");
    revalidatePath("/admin/students");
    revalidatePath("/admin/dashboard");

    return { ok: true, status: to };
  } catch (err) {
    if (err instanceof HttpError) {
      const fieldErrors =
        "errors" in err && typeof err.errors === "object"
          ? (err.errors as Record<string, string>)
          : undefined;
      return { error: err.code, fieldErrors };
    }
    throw err;
  }
}
