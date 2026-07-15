import { db } from "@/lib/db/client";
import {
  hashPassword,
  validatePassword,
  verifyPassword,
} from "@/lib/auth/password";
import { audit } from "@/lib/audit/log";
import { Forbidden, ValidationError } from "@/lib/errors";
import { isAccountAvailableForAuthentication } from "@/lib/account/status";

/**
 * Change own password (self-service)
 * Verifies current password, validates new, updates DB, audits.
 */
export async function changeOwnPassword(params: {
  userId: string;
  currentPassword: string;
  newPassword: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const { userId, currentPassword, newPassword, ipAddress, userAgent } = params;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      passwordHash: true,
      isActive: true,
      deletedAt: true,
    },
  });

  if (
    !user ||
    !isAccountAvailableForAuthentication({
      isActive: user.isActive,
      deletedAt: user.deletedAt,
    })
  ) {
    throw new Forbidden("user_unavailable");
  }

  // Verify current password
  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    throw new ValidationError({
      currentPassword: "รหัสผ่านปัจจุบันไม่ถูกต้อง",
    });
  }

  // Validate new password strength (by role)
  const pwOk = validatePassword(newPassword, user.role);
  if (!pwOk.ok) {
    throw new ValidationError({ newPassword: pwOk.reason });
  }

  // Reject same password
  if (currentPassword === newPassword) {
    throw new ValidationError({
      newPassword: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม",
    });
  }

  const newHash = await hashPassword(newPassword);

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        mustResetPwd: false,
      },
    });

    await audit(
      {
        actorId: userId,
        actorRole: user.role,
        action: "PASSWORD_CHANGED_SELF",
        targetType: "User",
        targetId: userId,
        ipAddress,
        userAgent,
      },
      tx
    );
  });
}
