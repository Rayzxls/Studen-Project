"use server";

import { signOut } from "@/lib/auth";
import { ChangePasswordSchema } from "@/lib/validation/schemas";
import { changeOwnPassword } from "@/lib/auth/change-password";
import { requireAuth } from "@/lib/auth/guards";
import { getRequestMeta } from "@/lib/utils/request";
import { HttpError, ValidationError } from "@/lib/errors";

export type ForceResetState = {
  fieldErrors?: Record<string, string>;
  error?: string;
};

export async function forceResetAction(
  _prev: ForceResetState,
  formData: FormData
): Promise<ForceResetState> {
  const session = await requireAuth();

  const raw = {
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  };

  const parsed = ChangePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join(".");
      if (!fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { fieldErrors };
  }

  const meta = await getRequestMeta();

  try {
    await changeOwnPassword({
      userId: session.user.id,
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return { fieldErrors: err.errors };
    }
    if (err instanceof HttpError) {
      return { error: err.message };
    }
    throw err;
  }

  // Sign out so the stale JWT (mustResetPwd=true) is discarded.
  // signOut throws NEXT_REDIRECT internally — code after is unreachable
  await signOut({ redirectTo: "/login?reset=success" });
  return {}; // satisfies TS; never executes
}
