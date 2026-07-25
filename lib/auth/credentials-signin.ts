import {
  isAccountAvailableForAuthentication,
  type AccountStatus,
} from "@/lib/account/status";
import { isRecoverableDeletionPending } from "@/lib/identity/account-deletion-service";

/**
 * The account-lifecycle facts the Credentials sign-in path reads once, before
 * verifying the password, to decide whether an account may sign in, must be
 * routed to recovery, or is simply unavailable. Keeping the decision pure makes
 * it independently testable and keeps `authorize` a thin orchestration.
 */
export type CredentialsAccountSnapshot = {
  isActive: boolean;
  deletedAt: Date | null;
  accountStatus: AccountStatus | null;
  deletionScheduledFor: Date | null;
  email: string | null;
};

export type CredentialsAccountGate =
  | { kind: "available" }
  | { kind: "recoverable"; email: string }
  | { kind: "unavailable" };

/**
 * Mirrors the Google sign-in resolver's Deletion Pending rule for the password
 * path: an account still inside its recovery window is not refused outright.
 * Once the password proves ownership, its owner is routed to `/recover` instead
 * of a session. A pending account whose window has passed, that records no
 * scheduled date, or that carries no email to hand into the recovery flow stays
 * unavailable and fails closed. The caller verifies the password regardless of
 * the outcome, so this never reveals whether an account exists.
 */
export function evaluateCredentialsAccountGate(
  snapshot: CredentialsAccountSnapshot,
  now: Date
): CredentialsAccountGate {
  if (isAccountAvailableForAuthentication(snapshot)) {
    return { kind: "available" };
  }

  if (
    snapshot.accountStatus === "DELETION_PENDING" &&
    isRecoverableDeletionPending(snapshot.deletionScheduledFor, now) &&
    snapshot.email
  ) {
    return { kind: "recoverable", email: snapshot.email };
  }

  return { kind: "unavailable" };
}
