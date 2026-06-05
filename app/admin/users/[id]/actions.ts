"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { getRequestMeta } from "@/lib/utils/request";
import { resetUserPassword } from "@/lib/admin/user-reset-password";
import { HttpError } from "@/lib/errors";

export interface ResetPasswordState {
  error?: string;
  ok?: boolean;
  tempPassword?: string;
  targetDisplayName?: string;
}

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const session = await requireRole(["ADMIN"]);
  const meta = await getRequestMeta();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "missing_user_id" };
  try {
    const result = await resetUserPassword(userId, {
      actorUserId: session.user.id,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
    revalidatePath(`/admin/users/${userId}`);
    return {
      ok: true,
      tempPassword: result.tempPassword,
      targetDisplayName: result.targetDisplayName,
    };
  } catch (err) {
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }
}
