import type { Role } from "@prisma/client";

import { Conflict, Forbidden, NotFound, ValidationError } from "@/lib/errors";
import {
  isAccountAvailableForAuthentication,
  type AccountStatus,
} from "@/lib/account/status";
import type { EmailSender } from "@/lib/email";
import { hasRecentReauthentication } from "./foundation";
import {
  EMAIL_CHANGE_TTL_MS,
  createEmailChangeToken,
  emailFingerprint,
  readEmailChangeToken,
} from "./email-change-token";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EmailChangeUser = {
  userId: string;
  email: string | null;
  identifier: string;
  role: Role;
  isActive: boolean;
  deletedAt: Date | null;
  accountStatus: AccountStatus | null;
};

export interface EmailChangeDatabasePort {
  findById(userId: string): Promise<EmailChangeUser | null>;
  writeRequestAudit(input: {
    userId: string;
    role: Role;
    occurredAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void>;
  /**
   * Atomically set the new email (and the canonical identifier when it tracked
   * the old email), mark it verified, bump `sessionVersion` to revoke every
   * other session, and audit EMAIL_CHANGED. Throws Conflict `email_taken` when
   * the address is already used by another account.
   */
  applyChange(input: {
    userId: string;
    role: Role;
    newEmail: string;
    updateIdentifier: boolean;
    occurredAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void>;
}

export type EmailChangeServiceOptions = {
  emailSender: EmailSender;
  secret: string;
  mutationsEnabled: boolean;
  /** Builds the absolute link the verification email carries. */
  verifyUrl: (token: string) => string;
  now?: () => Date;
};

function assertMutationsEnabled(enabled: boolean): void {
  if (!enabled) {
    throw new NotFound("identity_foundation_not_found");
  }
}

export function createEmailChangeService(
  database: EmailChangeDatabasePort,
  options: EmailChangeServiceOptions
) {
  const now = options.now ?? (() => new Date());
  const expiresInMinutes = Math.floor(EMAIL_CHANGE_TTL_MS / 60_000);

  return {
    /**
     * Sends a verification link to the proposed new address. Requires a recent
     * re-authentication (the pragmatic 20-minute window) because it is a
     * sensitive identity change. Uniqueness is not checked here — the link goes
     * to the new address, so only its owner can confirm — and is enforced when
     * the change is applied.
     */
    async request(input: {
      actor: { userId: string; reauthenticatedAt: Date | null };
      newEmail: string;
      ipAddress?: string;
      userAgent?: string;
    }): Promise<void> {
      assertMutationsEnabled(options.mutationsEnabled);
      const occurredAt = now();

      if (
        !hasRecentReauthentication({
          reauthenticatedAt: input.actor.reauthenticatedAt,
          now: occurredAt,
        })
      ) {
        throw new Forbidden("reauthentication_required");
      }

      const user = await database.findById(input.actor.userId);
      if (!user || !isAccountAvailableForAuthentication(user)) {
        throw new NotFound("email_change_invalid");
      }

      const newEmail = input.newEmail.trim().toLowerCase();
      if (!EMAIL_RE.test(newEmail) || newEmail.length > 254) {
        throw new ValidationError({ email: "email_invalid" });
      }
      if (newEmail === (user.email ?? "").trim().toLowerCase()) {
        throw new ValidationError({ email: "email_unchanged" });
      }

      const token = await createEmailChangeToken({
        userId: user.userId,
        currentEmail: user.email,
        newEmail,
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
        to: newEmail,
        template: {
          kind: "email_change_verification",
          verifyUrl: options.verifyUrl(token),
          expiresInMinutes,
        },
      });
    },

    /**
     * Applies the change from a valid link and revokes every other session.
     * Fails closed on a tampered/expired token, a since-deleted account, a link
     * whose fingerprint no longer matches the live email (already changed), or
     * an address taken by another account.
     */
    async confirm(input: {
      token: string;
      ipAddress?: string;
      userAgent?: string;
    }): Promise<{ userId: string; newEmail: string }> {
      assertMutationsEnabled(options.mutationsEnabled);

      const pending = await readEmailChangeToken({
        token: input.token,
        secret: options.secret,
        now: now(),
      });

      const user = await database.findById(pending.userId);
      if (!user || !isAccountAvailableForAuthentication(user)) {
        throw new NotFound("email_change_invalid");
      }

      if (emailFingerprint(user.email ?? "") !== pending.fingerprint) {
        throw new Conflict("email_change_superseded");
      }

      // Identity-v2 accounts authenticate by email, so the identifier tracks it;
      // a compatibility-era account keeps its existing identifier.
      const updateIdentifier =
        user.identifier.trim().toLowerCase() ===
        (user.email ?? "").trim().toLowerCase();

      await database.applyChange({
        userId: user.userId,
        role: user.role,
        newEmail: pending.newEmail,
        updateIdentifier,
        occurredAt: now(),
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });

      return { userId: user.userId, newEmail: pending.newEmail };
    },
  };
}
