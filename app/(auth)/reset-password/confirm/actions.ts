"use server";

import { redirect } from "next/navigation";

import { HttpError } from "@/lib/errors";
import { identityFoundationMutationsEnabled } from "@/lib/identity/feature-flags";
import { createPrismaPasswordRecoveryService } from "@/lib/identity/password-recovery-prisma";
import { getRequestMeta } from "@/lib/utils/request";
import type { SetNewPasswordState } from "@/components/auth/set-new-password-form";

const INVALID_LINK =
  "ลิงก์ไม่ถูกต้องหรือหมดอายุ กรุณาขอลิงก์ใหม่จากหน้าลืมรหัสผ่าน";

function messageForError(error: unknown): string {
  if (!(error instanceof HttpError)) {
    return "ตั้งรหัสผ่านใหม่ไม่สำเร็จ กรุณาลองใหม่";
  }
  switch (error.code) {
    case "validation_error":
      return "รหัสผ่านไม่ผ่านเงื่อนไข กรุณาเลือกใหม่";
    case "password_reset_already_used":
      return "ลิงก์นี้ถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่";
    case "password_reset_invalid":
      return INVALID_LINK;
    default:
      return INVALID_LINK;
  }
}

export async function completePasswordResetAction(
  _prev: SetNewPasswordState,
  formData: FormData
): Promise<SetNewPasswordState> {
  if (!identityFoundationMutationsEnabled()) {
    return { error: INVALID_LINK };
  }

  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  if (!token) {
    return { error: INVALID_LINK };
  }
  if (password !== confirmPassword) {
    return { error: "รหัสผ่านทั้งสองช่องไม่ตรงกัน" };
  }

  const meta = await getRequestMeta();
  try {
    await createPrismaPasswordRecoveryService().complete({
      token,
      newPassword: password,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
  } catch (error) {
    return { error: messageForError(error) };
  }

  // The reset revoked every session, so send them to sign in with the new
  // password; the login page shows a success banner for `?reset=success`.
  redirect("/login?reset=success");
}
