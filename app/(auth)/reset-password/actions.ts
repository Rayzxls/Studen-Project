"use server";

import { rateLimit } from "@/lib/auth/rate-limit";
import { identityFoundationMutationsEnabled } from "@/lib/identity/feature-flags";
import { createPrismaPasswordRecoveryService } from "@/lib/identity/password-recovery-prisma";
import { getRequestMeta } from "@/lib/utils/request";
import type { RecoveryRequestState } from "@/components/auth/password-recovery-request-form";

/**
 * Always resolves to the same neutral "sent" state whether or not the address
 * belongs to a recoverable account, so the form cannot be used to discover
 * which emails exist. Rate-limited per address to blunt abuse and mailbombing.
 */
export async function requestPasswordResetAction(
  _prev: RecoveryRequestState,
  formData: FormData
): Promise<RecoveryRequestState> {
  if (!identityFoundationMutationsEnabled()) {
    return { sent: true };
  }

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email || !email.includes("@")) {
    return { error: "กรุณากรอกอีเมลให้ถูกต้อง" };
  }

  const limit = await rateLimit({
    key: `pwreset:${email}`,
    max: 3,
    windowSec: 900,
    lockoutSec: 900,
  });
  if (!limit.allowed) {
    // Do not reveal the limit; look identical to a successful request.
    return { sent: true };
  }

  const meta = await getRequestMeta();
  try {
    await createPrismaPasswordRecoveryService().request({
      email,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
  } catch {
    // Never surface why: a failure must not distinguish a real account from a
    // missing one. The neutral state is returned regardless.
  }

  return { sent: true };
}
