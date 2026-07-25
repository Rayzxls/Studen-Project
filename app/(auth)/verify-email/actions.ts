"use server";

import { HttpError } from "@/lib/errors";
import { identityFoundationMutationsEnabled } from "@/lib/identity/feature-flags";
import { createPrismaEmailChangeService } from "@/lib/identity/email-change-prisma";
import { getRequestMeta } from "@/lib/utils/request";
import type { ConfirmEmailChangeState } from "@/components/auth/confirm-email-change-form";

const INVALID =
  "ลิงก์ยืนยันไม่ถูกต้องหรือหมดอายุ กรุณาขอเปลี่ยนอีเมลใหม่จากหน้าโปรไฟล์";

function messageForError(error: unknown): string {
  if (!(error instanceof HttpError)) {
    return "ยืนยันอีเมลไม่สำเร็จ กรุณาลองใหม่";
  }
  switch (error.code) {
    case "email_change_superseded":
      return "ลิงก์นี้ถูกใช้ไปแล้ว หรืออีเมลถูกเปลี่ยนไปแล้ว";
    case "email_taken":
      return "อีเมลนี้ถูกใช้กับบัญชีอื่นแล้ว";
    case "email_change_invalid":
      return INVALID;
    default:
      return INVALID;
  }
}

export async function confirmEmailChangeAction(
  _prev: ConfirmEmailChangeState,
  formData: FormData
): Promise<ConfirmEmailChangeState> {
  if (!identityFoundationMutationsEnabled()) {
    return { error: INVALID };
  }

  const token = String(formData.get("token") ?? "");
  if (!token) {
    return { error: INVALID };
  }

  const meta = await getRequestMeta();
  try {
    await createPrismaEmailChangeService().confirm({
      token,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
  } catch (error) {
    return { error: messageForError(error) };
  }

  // The change revoked every session; the owner signs in again with the new
  // email. Surfaced as a done state rather than a redirect because the person
  // may be confirming from a device where they were never signed in.
  return { done: true };
}
