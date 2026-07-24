import { ValidationError } from "@/lib/errors";

import type { PendingGoogleOnboarding } from "./pending-google-onboarding";
import type {
  StudentOnboardingResult,
  createStudentOnboardingService,
} from "./student-onboarding-service";

type StudentOnboardingService = ReturnType<
  typeof createStudentOnboardingService
>;

export type CompleteGoogleOnboardingDeps = {
  onboardingService: StudentOnboardingService;
  requiredConsent: {
    termsOfUseVersion: string;
    privacyNoticeVersion: string;
  };
};

export type CompleteGoogleOnboardingInput = {
  pending: PendingGoogleOnboarding;
  firstName: string;
  lastName: string;
  /** The single consent box the form presents, covering both documents. */
  acceptedConsent: boolean;
  occurredAt: Date;
  ipAddress?: string;
  userAgent?: string;
};

/**
 * Turns a verified pending assertion plus the onboarding form into a real
 * Student account. The Google email comes only from the signed pending token,
 * never from the submitted form, so the form cannot claim a different verified
 * address than the one Google proved. Real-name shape and consent versions are
 * enforced by the Student onboarding service.
 */
export async function completeGoogleOnboarding(
  deps: CompleteGoogleOnboardingDeps,
  input: CompleteGoogleOnboardingInput
): Promise<StudentOnboardingResult> {
  if (!input.acceptedConsent) {
    throw new ValidationError({ consent: "consent_required" });
  }

  return deps.onboardingService.register({
    google: {
      providerAccountId: input.pending.providerAccountId,
      email: input.pending.email,
      emailVerified: true,
    },
    firstName: input.firstName,
    lastName: input.lastName,
    consent: {
      termsOfUseVersion: deps.requiredConsent.termsOfUseVersion,
      privacyNoticeVersion: deps.requiredConsent.privacyNoticeVersion,
    },
    occurredAt: input.occurredAt,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
}
