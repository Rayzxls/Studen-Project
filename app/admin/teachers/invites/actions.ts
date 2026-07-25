"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/guards";
import { HttpError, ValidationError } from "@/lib/errors";
import { identityFoundationMutationsEnabled } from "@/lib/identity/feature-flags";
import { createPrismaTeacherInviteService } from "@/lib/identity/teacher-invite-prisma";

export type InviteState = {
  error?: string;
  fieldErrors?: { email?: string };
  issued?: {
    email: string;
    rawToken: string;
    expiresAt: string;
    replaced: number;
  };
};

const DISABLED_ERROR = "ระบบเชิญครูยังไม่เปิดใช้งาน";

export async function issueInviteAction(
  _prev: InviteState,
  formData: FormData
): Promise<InviteState> {
  const session = await requireRole(["ADMIN"]);
  if (!identityFoundationMutationsEnabled()) return { error: DISABLED_ERROR };

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { fieldErrors: { email: "กรุณากรอกอีเมล" } };

  try {
    const issued = await createPrismaTeacherInviteService().issue({
      actorUserId: session.user.id,
      email,
      occurredAt: new Date(),
    });
    revalidatePath("/admin/teachers/invites");
    return {
      issued: {
        email: issued.email,
        rawToken: issued.rawToken,
        expiresAt: issued.expiresAt.toISOString(),
        replaced: issued.replacedInviteCount,
      },
    };
  } catch (err) {
    if (err instanceof ValidationError) {
      return { fieldErrors: { email: "อีเมลไม่ถูกต้อง" } };
    }
    if (err instanceof HttpError) {
      if (err.code === "teacher_invite_account_exists") {
        return { error: "อีเมลนี้เป็นบัญชีครูอยู่แล้ว" };
      }
      if (err.code === "teacher_invite_role_collision") {
        return { error: "อีเมลนี้ถูกใช้กับบัญชีบทบาทอื่นแล้ว" };
      }
      return { error: "ไม่สามารถสร้างคำเชิญได้ กรุณาลองใหม่" };
    }
    throw err;
  }
}

export async function revokeInviteAction(
  _prev: InviteState,
  formData: FormData
): Promise<InviteState> {
  const session = await requireRole(["ADMIN"]);
  const inviteId = String(formData.get("inviteId") ?? "");
  if (!inviteId) return { error: "ไม่พบคำเชิญ" };

  try {
    await createPrismaTeacherInviteService().revoke({
      actorUserId: session.user.id,
      inviteId,
      reason: "ยกเลิกโดยผู้ดูแลระบบ",
      occurredAt: new Date(),
    });
    revalidatePath("/admin/teachers/invites");
    return {};
  } catch (err) {
    if (err instanceof HttpError) {
      return { error: "ยกเลิกคำเชิญไม่สำเร็จ (อาจถูกใช้หรือยกเลิกไปแล้ว)" };
    }
    throw err;
  }
}
