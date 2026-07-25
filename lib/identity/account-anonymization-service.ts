import type { Role } from "@prisma/client";

import { NotFound } from "@/lib/errors";
import { DISABLED_COMPATIBILITY_PASSWORD_HASH } from "./foundation";
import { isRecoverableDeletionPending } from "./account-deletion-service";

/**
 * Placeholder shown wherever an anonymized Student's name would appear. The
 * academic rows (Score, Submission, Attendance) are preserved under the internal
 * User id; only the displayable name is replaced.
 */
export const ANONYMIZED_STUDENT_NAME = {
  firstName: "ผู้ใช้ที่ถูกลบ",
  lastName: "",
} as const;

/**
 * The values written over a User's identifying columns at anonymization. Email
 * is nulled (the column is nullable and unique, so several nulls coexist); the
 * required unique identifier becomes an opaque, non-public value derived from
 * the internal id; the password is reset to the disabled sentinel so no
 * credential survives. Pure so it can be asserted directly.
 */
export function anonymizedUserFields(userId: string) {
  return {
    identifier: `anonymized:${userId}`,
    email: null as string | null,
    emailVerifiedAt: null as Date | null,
    passwordHash: DISABLED_COMPATIBILITY_PASSWORD_HASH,
    firstName: null as string | null,
    lastName: null as string | null,
    displayName: null as string | null, // dependency-gate-allow(legacy-display-name): anonymization must null the legacy column; the reference is unavoidable until the column is dropped
    profileImageId: null as string | null,
    isActive: false,
  };
}

export type AnonymizationCandidate = {
  userId: string;
  role: Role;
  accountStatus: "DELETION_PENDING" | (string & {});
  deletionScheduledFor: Date | null;
};

export interface AccountAnonymizationTransactionPort {
  /** Re-reads the account inside the tx to guard against a race with recovery. */
  reloadCandidate(userId: string): Promise<AnonymizationCandidate | null>;
  applyAnonymization(input: {
    userId: string;
    anonymizedAt: Date;
  }): Promise<void>;
  createAuditLogs(
    input: ReadonlyArray<{
      actorId: string;
      actorRole: Role;
      action: "ACCOUNT_ANONYMIZED";
      targetType: string;
      targetId: string;
      targetLabel: string;
      after: Record<string, unknown>;
      timestamp: Date;
    }>
  ): Promise<void>;
}

export interface AccountAnonymizationDatabasePort {
  listExpiredDeletionPending(
    now: Date,
    limit: number
  ): Promise<ReadonlyArray<{ userId: string; role: Role }>>;
  transaction<T>(
    work: (tx: AccountAnonymizationTransactionPort) => Promise<T>
  ): Promise<T>;
}

export type AccountAnonymizationServiceOptions = {
  mutationsEnabled: boolean;
  batchLimit: number;
};

export type AccountAnonymizationResult = {
  anonymizedUserIds: string[];
  skippedUserIds: string[];
};

function assertMutationsEnabled(enabled: boolean): void {
  if (!enabled) {
    throw new NotFound("identity_foundation_not_found");
  }
}

export function createAccountAnonymizationService(
  database: AccountAnonymizationDatabasePort,
  options: AccountAnonymizationServiceOptions
) {
  return {
    /**
     * Anonymizes every Deletion Pending account whose recovery window has
     * lapsed. Each account is handled in its own transaction that re-checks
     * eligibility first, so an account recovered between listing and writing is
     * skipped rather than wrongly erased. Irreversible by design.
     */
    async anonymizeExpiredDeletions(input: {
      now: Date;
    }): Promise<AccountAnonymizationResult> {
      assertMutationsEnabled(options.mutationsEnabled);

      const candidates = await database.listExpiredDeletionPending(
        input.now,
        options.batchLimit
      );

      const anonymizedUserIds: string[] = [];
      const skippedUserIds: string[] = [];

      for (const candidate of candidates) {
        const outcome = await database.transaction(async (tx) => {
          const fresh = await tx.reloadCandidate(candidate.userId);
          // Still pending and still past the window? Recovery may have cleared
          // it, or a clock skew may have crept in — either way, do not erase.
          if (
            !fresh ||
            fresh.accountStatus !== "DELETION_PENDING" ||
            isRecoverableDeletionPending(fresh.deletionScheduledFor, input.now)
          ) {
            return "skipped" as const;
          }

          await tx.applyAnonymization({
            userId: fresh.userId,
            anonymizedAt: input.now,
          });

          await tx.createAuditLogs([
            {
              actorId: fresh.userId,
              actorRole: fresh.role,
              action: "ACCOUNT_ANONYMIZED",
              targetType: "User",
              targetId: fresh.userId,
              // No PII in the record of anonymization — only the internal id.
              targetLabel: fresh.userId,
              after: { accountStatus: "ANONYMIZED" },
              timestamp: input.now,
            },
          ]);

          return "anonymized" as const;
        });

        if (outcome === "anonymized") anonymizedUserIds.push(candidate.userId);
        else skippedUserIds.push(candidate.userId);
      }

      return { anonymizedUserIds, skippedUserIds };
    },
  };
}
