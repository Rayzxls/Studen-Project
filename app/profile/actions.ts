"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AuthError } from "next-auth";
import { requireAuth } from "@/lib/auth/guards";
import {
  removeProfileImage,
  setProfileImage,
  updateDisplayName,
} from "@/lib/profile/mutations";
import { parseThemeMode, updateOwnThemeMode } from "@/lib/theme/mode";
import { changeOwnPassword } from "@/lib/auth/change-password";
import { signIn, signOut } from "@/lib/auth";
import { createPrismaAccountDeletionService } from "@/lib/identity/account-deletion-prisma";
import { createPrismaFallbackPasswordService } from "@/lib/identity/fallback-password-prisma";
import { createPrismaEmailChangeService } from "@/lib/identity/email-change-prisma";
import { identityFoundationMutationsEnabled } from "@/lib/identity/feature-flags";
import { hasRecentReauthentication } from "@/lib/identity/foundation";
import {
  PENDING_PROVIDER_LINK_COOKIE,
  PENDING_PROVIDER_LINK_TTL_MS,
  createPendingProviderLinkToken,
} from "@/lib/identity/pending-provider-link";
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

/**
 * Self-service account deletion (D1): moves the caller's own account to
 * Deletion Pending, then signs the current device out immediately. Sign-in is
 * blocked afterwards by the standard availability predicate. Nothing is erased —
 * recovery within the window and post-window anonymization are separate slices.
 */
export async function requestAccountDeletionAction(
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const session = await requireAuth();
  const meta = await getRequestMeta();

  if (String(formData.get("confirm") ?? "").trim() !== "DELETE") {
    return {
      fieldErrors: { confirm: 'พิมพ์ "DELETE" เพื่อยืนยันการลบบัญชี' },
    };
  }

  const reauthenticatedAt = session.user.signInAt
    ? new Date(session.user.signInAt * 1000)
    : null;

  try {
    await createPrismaAccountDeletionService().requestOwnDeletion({
      actor: { userId: session.user.id, reauthenticatedAt },
      occurredAt: new Date(),
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
  } catch (err) {
    if (err instanceof Forbidden && err.code === "reauthentication_required") {
      return {
        error:
          "เพื่อความปลอดภัย กรุณาเข้าสู่ระบบใหม่ แล้วลองอีกครั้งภายใน 20 นาที",
      };
    }
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }

  // End this device's session now and send the owner to login. Throws a
  // redirect, so nothing after this runs.
  await signOut({ redirectTo: "/login?deletion=pending" });
  return {};
}

/**
 * Requests a verified-email change (Release D). Ownership comes from the same
 * pragmatic re-auth rule as the other sensitive Profile mutations; the service
 * re-checks the window, then emails a single-use link to the NEW address. The
 * canonical identifier and session revocation happen only when that link is
 * confirmed at /verify-email, never here.
 */
export async function requestEmailChangeAction(
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const session = await requireAuth();
  const meta = await getRequestMeta();

  const newEmail = String(formData.get("newEmail") ?? "");
  const reauthenticatedAt = session.user.signInAt
    ? new Date(session.user.signInAt * 1000)
    : null;

  try {
    await createPrismaEmailChangeService().request({
      actor: { userId: session.user.id, reauthenticatedAt },
      newEmail,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
  } catch (err) {
    if (err instanceof Forbidden && err.code === "reauthentication_required") {
      return {
        error:
          "เพื่อความปลอดภัย กรุณาเข้าสู่ระบบใหม่ แล้วลองอีกครั้งภายใน 20 นาที",
      };
    }
    if (err instanceof ValidationError) {
      return {
        fieldErrors: {
          newEmail:
            err.errors.email === "email_unchanged"
              ? "อีเมลนี้เป็นอีเมลปัจจุบันของคุณอยู่แล้ว"
              : "รูปแบบอีเมลไม่ถูกต้อง",
        },
      };
    }
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }

  return { ok: true };
}

/**
 * Starts linking Google to the account the caller is already signed in as
 * (ADR-0041 forbids linking by email match alone). Requires a recent
 * re-authentication, then stores a signed link-intent cookie and hands off to
 * Google; the sign-in callback attaches the returned identity to this account
 * and redirects back with a `?linked=` status. Nothing is written here.
 */
export async function startGoogleLinkAction(): Promise<void> {
  const session = await requireAuth();
  if (!identityFoundationMutationsEnabled()) {
    redirect("/profile");
  }

  const reauthenticatedAt = session.user.signInAt
    ? new Date(session.user.signInAt * 1000)
    : null;
  if (!hasRecentReauthentication({ reauthenticatedAt, now: new Date() })) {
    redirect("/profile?linked=reauth");
  }

  const secret = process.env.AUTH_SECRET ?? "";
  const token = await createPendingProviderLinkToken({
    pending: {
      userId: session.user.id,
      signInAt: session.user.signInAt ?? null,
    },
    secret,
  });
  (await cookies()).set(PENDING_PROVIDER_LINK_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(PENDING_PROVIDER_LINK_TTL_MS / 1000),
  });

  try {
    await signIn("google", { redirectTo: "/profile" });
  } catch (error) {
    // A configuration failure is safe to surface generically; a successful
    // start throws NEXT_REDIRECT to Google, which must propagate.
    if (error instanceof AuthError) {
      redirect("/profile?linked=error");
    }
    throw error;
  }
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
