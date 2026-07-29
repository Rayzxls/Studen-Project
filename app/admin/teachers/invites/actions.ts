"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/guards";
import { HttpError, ValidationError } from "@/lib/errors";
import { identityFoundationMutationsEnabled } from "@/lib/identity/feature-flags";
import { createPrismaTeacherInviteService } from "@/lib/identity/teacher-invite-prisma";
import {
  parseTeacherInviteCsv,
  TeacherInviteCsvError,
} from "@/lib/identity/teacher-invite-csv";

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

export type BulkInviteState = {
  error?: string;
  detail?: string;
  result?: {
    issued: Array<{
      email: string;
      rawToken: string;
      expiresAt: string;
      replaced: number;
    }>;
    failed: Array<{ email: string; error: string }>;
  };
};

const DISABLED_ERROR = "ระบบเชิญครูยังไม่เปิดใช้งาน";

function inviteErrorMessage(error: HttpError): string {
  if (error.code === "teacher_invite_account_exists") {
    return "อีเมลนี้เป็นบัญชีครูอยู่แล้ว";
  }
  if (error.code === "teacher_invite_role_collision") {
    return "อีเมลนี้ถูกใช้กับบัญชีบทบาทอื่นแล้ว";
  }
  return "ไม่สามารถสร้างคำเชิญได้";
}

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
      return { error: inviteErrorMessage(err) };
    }
    throw err;
  }
}

export async function issueBulkInvitesAction(
  _prev: BulkInviteState,
  formData: FormData
): Promise<BulkInviteState> {
  const session = await requireRole(["ADMIN"]);
  if (!identityFoundationMutationsEnabled()) return { error: DISABLED_ERROR };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "กรุณาเลือกไฟล์ CSV" };
  }

  let rows;
  try {
    rows = parseTeacherInviteCsv(await file.text());
  } catch (error) {
    if (error instanceof TeacherInviteCsvError) {
      return { error: error.message, detail: error.detail };
    }
    throw error;
  }

  const service = createPrismaTeacherInviteService();
  const issued: NonNullable<BulkInviteState["result"]>["issued"] = [];
  const failed: NonNullable<BulkInviteState["result"]>["failed"] = [];

  for (const row of rows) {
    try {
      const invite = await service.issue({
        actorUserId: session.user.id,
        email: row.email,
        occurredAt: new Date(),
      });
      issued.push({
        email: invite.email,
        rawToken: invite.rawToken,
        expiresAt: invite.expiresAt.toISOString(),
        replaced: invite.replacedInviteCount,
      });
    } catch (error) {
      if (error instanceof HttpError) {
        failed.push({ email: row.email, error: inviteErrorMessage(error) });
        continue;
      }
      throw error;
    }
  }

  revalidatePath("/admin/teachers/invites");
  return { result: { issued, failed } };
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
