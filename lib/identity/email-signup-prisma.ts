import type { PrismaClient } from "@prisma/client";

import { db } from "@/lib/db/client";
import { Conflict } from "@/lib/errors";

const TX_OPTS = {
  maxWait: 10_000,
  timeout: 20_000,
  isolationLevel: "Serializable" as const,
};

export type EmailStudentSignupInput = {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  consent: { termsOfUseVersion: string; privacyNoticeVersion: string };
  occurredAt: Date;
  ipAddress?: string;
  userAgent?: string;
};

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/**
 * Creates a Student account from an email + a password the user chose (ADR-0043),
 * atomically with its two consent records and a `STUDENT_SELF_REGISTERED` audit.
 * The email is stored but left unverified (`emailVerifiedAt` null); ownership of
 * the address is proven later, either by linking Google from Profile (the email
 * must match) or by a future verification step. A duplicate email throws
 * Conflict `email_taken`.
 */
export async function registerEmailPasswordStudent(
  input: EmailStudentSignupInput,
  client: PrismaClient = db
): Promise<{ userId: string }> {
  try {
    return await client.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          identifier: input.email,
          email: input.email,
          emailVerifiedAt: null,
          passwordHash: input.passwordHash,
          role: "STUDENT",
          firstName: input.firstName,
          lastName: input.lastName,
          createdAt: input.occurredAt,
          student: {
            create: {
              firstName: input.firstName,
              lastName: input.lastName,
            },
          },
        },
        select: { id: true },
      });

      await tx.consentAcceptance.createMany({
        data: [
          {
            userId: user.id,
            document: "TERMS_OF_USE",
            version: input.consent.termsOfUseVersion,
            acceptedAt: input.occurredAt,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
          },
          {
            userId: user.id,
            document: "PRIVACY_NOTICE",
            version: input.consent.privacyNoticeVersion,
            acceptedAt: input.occurredAt,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
          },
        ],
      });

      await tx.auditLog.create({
        data: {
          timestamp: input.occurredAt,
          actorId: user.id,
          actorRole: "STUDENT",
          action: "STUDENT_SELF_REGISTERED",
          targetType: "User",
          targetId: user.id,
          targetLabel: input.email,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        },
      });

      return { userId: user.id };
    }, TX_OPTS);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Conflict("email_taken");
    }
    throw error;
  }
}
