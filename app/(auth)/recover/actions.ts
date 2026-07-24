"use server";

import { AuthError } from "next-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { signIn } from "@/lib/auth";
import { ONBOARDING_SESSION_PROVIDER_ID } from "@/lib/auth/onboarding-session-provider";
import { HttpError } from "@/lib/errors";
import { createPrismaAccountRecoveryService } from "@/lib/identity/account-recovery-prisma";
import { identityFoundationMutationsEnabled } from "@/lib/identity/feature-flags";
import { createOnboardingSessionHandoff } from "@/lib/identity/onboarding-session-handoff";
import {
  PENDING_RECOVERY_COOKIE,
  readPendingAccountRecoveryToken,
} from "@/lib/identity/pending-account-recovery";
import { getRequestMeta } from "@/lib/utils/request";

export type RecoverState = { error?: string };

const GENERIC_ERROR = "ไม่สามารถกู้คืนบัญชีได้ กรุณาเริ่มใหม่ด้วย Google";

export async function recoverAccountAction(
  _state: RecoverState,
  _formData: FormData
): Promise<RecoverState> {
  if (!identityFoundationMutationsEnabled()) {
    return { error: GENERIC_ERROR };
  }

  const secret = process.env.AUTH_SECRET ?? "";
  const cookieStore = await cookies();
  const token = cookieStore.get(PENDING_RECOVERY_COOKIE)?.value;
  if (!token) {
    return { error: "หมดเวลาการยืนยัน กรุณาเริ่มใหม่ด้วย Google" };
  }

  let pending;
  try {
    pending = await readPendingAccountRecoveryToken({ token, secret });
  } catch {
    return { error: "หมดเวลาการยืนยัน กรุณาเริ่มใหม่ด้วย Google" };
  }

  const meta = await getRequestMeta();

  try {
    await createPrismaAccountRecoveryService().recoverOwnAccount({
      userId: pending.userId,
      occurredAt: new Date(),
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
  } catch (error) {
    if (error instanceof HttpError) return { error: GENERIC_ERROR };
    throw error;
  }

  // The account is Active again; the handoff is single-use, so clear it.
  cookieStore.delete(PENDING_RECOVERY_COOKIE);

  // Sign the recovered owner straight in through the same handoff the one-click
  // onboarding uses, so recovery ends on the dashboard rather than at login.
  const handoff = await createOnboardingSessionHandoff({
    userId: pending.userId,
    secret,
  });
  try {
    await signIn(ONBOARDING_SESSION_PROVIDER_ID, {
      handoff,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?recovered=1");
    }
    throw error; // a successful sign-in throws NEXT_REDIRECT to /dashboard
  }

  return {}; // not reached: signIn always throws
}
