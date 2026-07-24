"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/guards";
import {
  removeProfileImage,
  setProfileImage,
  updateDisplayName,
} from "@/lib/profile/mutations";
import { parseThemeMode, updateOwnThemeMode } from "@/lib/theme/mode";
import { changeOwnPassword } from "@/lib/auth/change-password";
import { createPrismaFallbackPasswordService } from "@/lib/identity/fallback-password-prisma";
import { getRequestMeta } from "@/lib/utils/request";
import { Forbidden, HttpError, ValidationError } from "@/lib/errors";

/**
 * Server Actions — /profile (Phase 13).
 *
 * Pattern 6 + 8. Every mutation routes through lib/profile (audited in-tx)
 * or lib/auth/change-password (PASSWORD_CHANGED_SELF audit). All actions
 * operate on the session user only — there is no "edit someone else's
 * profile" path here (the admin photo reset lives under /admin).
 */

export type ProfileFormState = {
  fieldErrors?: Record<string, string>;
  error?: string;
  ok?: boolean;
};

export async function updateDisplayNameAction(
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const session = await requireAuth();
  const meta = await getRequestMeta();
  try {
    await updateDisplayName(
      { displayName: String(formData.get("displayName") ?? "") },
      {
        actorUserId: session.user.id,
        actorRole: session.user.role,
        ipAddress: meta.ipAddress ?? undefined,
        userAgent: meta.userAgent ?? undefined,
      }
    );
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Imperative action — the avatar editor calls this after commit succeeds. */
export async function saveProfileImageAction(
  fileId: string
): Promise<ProfileFormState> {
  const session = await requireAuth();
  const meta = await getRequestMeta();
  try {
    await setProfileImage(
      { fileId },
      {
        actorUserId: session.user.id,
        actorRole: session.user.role,
        ipAddress: meta.ipAddress ?? undefined,
        userAgent: meta.userAgent ?? undefined,
      }
    );
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteProfileImageAction(): Promise<ProfileFormState> {
  const session = await requireAuth();
  const meta = await getRequestMeta();
  try {
    await removeProfileImage(
      { targetUserId: session.user.id },
      {
        actorUserId: session.user.id,
        actorRole: session.user.role,
        ipAddress: meta.ipAddress ?? undefined,
        userAgent: meta.userAgent ?? undefined,
      }
    );
  } catch (err) {
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function changePasswordAction(
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const session = await requireAuth();
  const meta = await getRequestMeta();

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword !== confirmPassword) {
    return {
      fieldErrors: { confirmPassword: "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน" },
    };
  }

  try {
    await changeOwnPassword({
      userId: session.user.id,
      currentPassword,
      newPassword,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }
  return { ok: true };
}

/**
 * Sets the optional fallback password for a Google-first account that has none
 * yet (its hash is the disabled compatibility sentinel). Unlike the legacy
 * change-password flow, there is no current password to verify, so ownership
 * comes from the pragmatic re-auth rule: a sign-in within the window counts as a
 * recent re-authentication. The service still re-checks the window and account
 * availability before writing.
 */
export async function setFallbackPasswordAction(
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const session = await requireAuth();
  const meta = await getRequestMeta();

  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword !== confirmPassword) {
    return { fieldErrors: { confirmPassword: "รหัสผ่านทั้งสองช่องไม่ตรงกัน" } };
  }

  const reauthenticatedAt = session.user.signInAt
    ? new Date(session.user.signInAt * 1000)
    : null;

  try {
    await createPrismaFallbackPasswordService().setOwnFallbackPassword({
      actor: { userId: session.user.id, reauthenticatedAt },
      newPassword,
      occurredAt: new Date(),
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
  } catch (err) {
    if (err instanceof Forbidden && err.code === "reauthentication_required") {
      return {
        error:
          "เพื่อความปลอดภัย กรุณาเข้าสู่ระบบใหม่ แล้วตั้งรหัสผ่านภายใน 20 นาที",
      };
    }
    if (err instanceof ValidationError) {
      const code = err.errors.password;
      return {
        fieldErrors: {
          newPassword:
            code === "fallback_password_too_common"
              ? "รหัสผ่านนี้คาดเดาง่ายเกินไป กรุณาเลือกรหัสอื่น"
              : "รหัสผ่านสั้นเกินไป (อย่างน้อย 8 ตัวอักษร)",
        },
      };
    }
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }

  revalidatePath("/profile");
  return { ok: true };
}

export async function updateThemeModeAction(
  themeModeInput: string
): Promise<ProfileFormState> {
  const session = await requireAuth();

  try {
    const themeMode = parseThemeMode(themeModeInput);
    await updateOwnThemeMode({ userId: session.user.id, themeMode });
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }

  revalidatePath("/profile");
  return { ok: true };
}
