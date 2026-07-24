export type AccountStatus =
  | "ACTIVE"
  | "SUSPENDED"
  | "DELETION_PENDING"
  | "TERMINATED"
  | "ANONYMIZED";

export type LegacyAccountState = {
  isActive: boolean;
  deletedAt: Date | null;
  studentAnonymized?: boolean | null;
};

export type AccountStateSnapshot = LegacyAccountState & {
  accountStatus?: AccountStatus | null;
};

/**
 * Maps the legacy flags into the canonical lifecycle state. The ordering is
 * intentional: anonymization and termination are stronger than suspension.
 */
export function deriveLegacyAccountStatus(
  state: LegacyAccountState
): AccountStatus {
  if (state.studentAnonymized) return "ANONYMIZED";
  if (state.deletedAt) return "TERMINATED";
  if (!state.isActive) return "SUSPENDED";
  return "ACTIVE";
}

/**
 * During the additive rollout, prefer the canonical column when available and
 * retain a deterministic fallback for pre-migration snapshots and test data.
 */
export function resolveAccountStatus(
  state: AccountStateSnapshot
): AccountStatus {
  return state.accountStatus ?? deriveLegacyAccountStatus(state);
}

export function canAuthenticateWithAccountStatus(
  status: AccountStatus
): boolean {
  return status === "ACTIVE";
}

export function isAccountAvailableForAuthentication(
  state: AccountStateSnapshot
): boolean {
  return canAuthenticateWithAccountStatus(resolveAccountStatus(state));
}
