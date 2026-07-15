import type { Role } from "@prisma/client";
import { Conflict, Forbidden, NotFound, ValidationError } from "@/lib/errors";
import { accountLifecycleMutationsEnabled } from "./feature-flags";
import {
  decideAccountTransition,
  type AccountStatus,
  type AccountTransitionDecision,
} from "./lifecycle-policy";

type SuspendReactivateTarget = "ACTIVE" | "SUSPENDED";
type AllowedTransition = Extract<AccountTransitionDecision, { allowed: true }>;

export type AccountLifecycleContext = {
  target: {
    userId: string;
    role: Role;
    status: AccountStatus;
    activeOwnedCourseCount: number;
  };
  activeAdminCount: number;
  hasOpenWorkOrDispute: boolean;
};

export type AccountLifecycleCommit = {
  actor: { userId: string; role: Role };
  target: AccountLifecycleContext["target"];
  transition: AllowedTransition;
  internalReason: string;
  userMessage: string;
  occurredAt: Date;
};

/**
 * The adapter must persist canonical status, legacy flags, lifecycle history,
 * Audit Log, and session revocation in one database transaction.
 */
export interface AccountLifecycleRepository {
  loadContext(targetUserId: string): Promise<AccountLifecycleContext | null>;
  commitTransition(input: AccountLifecycleCommit): Promise<void>;
}

export type SuspendReactivateCommand = {
  actor: { userId: string; role: Role };
  targetUserId: string;
  to: SuspendReactivateTarget;
  internalReason: string;
  userMessage: string;
};

export type AccountLifecycleServiceDependencies = {
  repository: AccountLifecycleRepository;
  mutationsEnabled?: boolean;
  now?: () => Date;
};

const MIN_EXPLANATION_LENGTH = 5;
const MAX_INTERNAL_REASON_LENGTH = 1_000;
const MAX_USER_MESSAGE_LENGTH = 500;

function validateExplanations(command: SuspendReactivateCommand): {
  internalReason: string;
  userMessage: string;
} {
  const internalReason = command.internalReason.trim();
  const userMessage = command.userMessage.trim();
  const errors: Record<string, string> = {};

  if (
    internalReason.length < MIN_EXPLANATION_LENGTH ||
    internalReason.length > MAX_INTERNAL_REASON_LENGTH
  ) {
    errors.internalReason = "account_lifecycle_internal_reason_invalid";
  }

  if (
    userMessage.length < MIN_EXPLANATION_LENGTH ||
    userMessage.length > MAX_USER_MESSAGE_LENGTH
  ) {
    errors.userMessage = "account_lifecycle_user_message_invalid";
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }

  return { internalReason, userMessage };
}

function throwPolicyError(code: string): never {
  if (
    code === "admin_lifecycle_operator_required" ||
    code === "account_lifecycle_self_action_forbidden"
  ) {
    throw new Forbidden(code);
  }

  throw new Conflict(code);
}

export async function suspendOrReactivateAccount(
  command: SuspendReactivateCommand,
  dependencies: AccountLifecycleServiceDependencies
): Promise<AllowedTransition> {
  const mutationsEnabled =
    dependencies.mutationsEnabled ?? accountLifecycleMutationsEnabled();

  if (!mutationsEnabled) {
    throw new Forbidden("account_lifecycle_mutations_disabled");
  }

  const explanations = validateExplanations(command);
  const context = await dependencies.repository.loadContext(
    command.targetUserId
  );

  if (!context) {
    throw new NotFound("account_not_found");
  }

  const decision = decideAccountTransition({
    actor: command.actor,
    target: context.target,
    to: command.to,
    activeAdminCount: context.activeAdminCount,
    temporaryPasswordPrepared: false,
    hasOpenWorkOrDispute: context.hasOpenWorkOrDispute,
  });

  if (!decision.allowed) {
    throwPolicyError(decision.code);
  }

  await dependencies.repository.commitTransition({
    actor: command.actor,
    target: context.target,
    transition: decision,
    ...explanations,
    occurredAt: dependencies.now?.() ?? new Date(),
  });

  return decision;
}
