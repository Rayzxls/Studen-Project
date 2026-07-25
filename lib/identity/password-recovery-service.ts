import type { Role } from "@prisma/client";

import { Conflict, NotFound, ValidationError } from "@/lib/errors";
import {
  isAccountAvailableForAuthentication,
  type AccountStatus,
} from "@/lib/account/status";
import { validatePassword } from "@/lib/auth/password";
import type { EmailSender } from "@/lib/email";
import { DISABLED_COMPATIBILITY_PASSWORD_HASH } from "./foundation";
import {
  PASSWORD_RESET_TTL_MS,
  createPasswordResetToken,
  passwordHashFingerprint,
  readPasswordResetToken,
} from "./password-reset-token";

export type RecoverableUser = {
  userId: string;
  email: string | null;
  role: Role;
  passwordHash: string;
  isActive: boolean;
  deletedAt: Date | null;
  accountStatus: AccountStatus | null;
};

export interface PasswordRecoveryDatabasePort {
  findByEmail(email: string): Promise<RecoverableUser | null>;
  findById(userId: string): Promise<RecoverableUser | null>;
  /** Audit that a reset link was requested for a real, eligible account. */
  writeRequestAudit(input: {
    userId: string;
    role: Role;
    occurredAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void>;
  /**
   * Atomically set the new hash, bump `sessionVersion` (revoking every other
   * session), and write the completion audit. The hash change is what makes the
   * used reset link single-use.
   */
  applyReset(input: {
    userId: string;
    role: Role;
    passwordHash: string;
    occurredAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void>;
}

export type PasswordRecoveryServiceOptions = {
  emailSender: EmailSender;
  secret: string;
  mutationsEnabled: boolean;
  /** Injected so unit tests can use a fast fake instead of bcrypt. */
  hashPassword: (plain: string) => Promise<string>;
  /** Builds the absolute link the email carries, given the reset token. */
  resetUrl: (token: string) => string;
  now?: () => Date;
};

function assertMutationsEnabled(enabled: boolean): void {
  if (!enabled) {
    throw new NotFound("identity_foundation_not_found");
  }
}

/** True only for an account that can actually own and use a fallback password. */
function isRecoverable(user: RecoverableUser): boolean {
  return (
    !!user.email &&
    user.passwordHash !== DISABLED_COMPATIBILITY_PASSWORD_HASH &&
    isAccountAvailableForAuthentication(user)
  );
}

export function createPasswordRecoveryService(
  database: PasswordRecoveryDatabasePort,
  options: PasswordRecoveryServiceOptions
) {
  const now = options.now ?? (() => new Date());
  const expiresInMinutes = Math.floor(PASSWORD_RESET_TTL_MS / 60_000);

  return {
    /**
     * Emails a single-use reset link when the address belongs to a recoverable
     * account. Always resolves without revealing whether it did, so the endpoint
     * cannot be used to probe which emails exist. Rate limiting is the caller's
     * responsibility.
     */
    async request(input: {
      email: string;
      ipAddress?: string;
      userAgent?: string;
    }): Promise<void> {
      assertMutationsEnabled(options.mutationsEnabled);

      const email = input.email.trim().toLowerCase();
      if (!email) return;

      const user = await database.findByEmail(email);
      if (!user || !isRecoverable(user) || !user.email) return;

      const occurredAt = now();
      const token = await createPasswordResetToken({
        userId: user.userId,
        passwordHash: user.passwordHash,
        secret: options.secret,
        now: occurredAt,
      });

      await database.writeRequestAudit({
        userId: user.userId,
        role: user.role,
        occurredAt,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });

      await options.emailSender.send({
        to: user.email,
        template: {
          kind: "password_recovery",
          recoveryUrl: options.resetUrl(token),
          expiresInMinutes,
        },
      });
    },

    /**
     * Sets a new password from a valid, unused reset link and revokes every
     * other session. Fails closed on a tampered/expired token, a since-deleted
     * or password-less account, an already-used link (the live hash no longer
     * matches the token fingerprint), or a weak password.
     */
    async complete(input: {
      token: string;
      newPassword: string;
      ipAddress?: string;
      userAgent?: string;
    }): Promise<{ userId: string }> {
      assertMutationsEnabled(options.mutationsEnabled);

      const pending = await readPasswordResetToken({
        token: input.token,
        secret: options.secret,
        now: now(),
      });

      const user = await database.findById(pending.userId);
      if (!user || !isRecoverable(user)) {
        // Fail closed without revealing which condition failed.
        throw new NotFound("password_reset_invalid");
      }

      if (passwordHashFingerprint(user.passwordHash) !== pending.fingerprint) {
        throw new Conflict("password_reset_already_used");
      }

      const validity = validatePassword(input.newPassword, user.role);
      if (!validity.ok) {
        throw new ValidationError({ password: validity.reason });
      }

      const passwordHash = await options.hashPassword(input.newPassword);
      await database.applyReset({
        userId: user.userId,
        role: user.role,
        passwordHash,
        occurredAt: now(),
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });

      return { userId: user.userId };
    },
  };
}
