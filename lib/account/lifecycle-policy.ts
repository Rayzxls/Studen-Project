import type { Role } from "@prisma/client";

export type AccountStatus =
  | "ACTIVE"
  | "SUSPENDED"
  | "TERMINATED"
  | "ANONYMIZED";

export type AccountTransitionInput = {
  actor: { userId: string; role: Role };
  target: {
    userId: string;
    role: Role;
    status: AccountStatus;
    activeOwnedCourseCount: number;
  };
  to: AccountStatus;
  activeAdminCount: number;
  temporaryPasswordPrepared: boolean;
  hasOpenWorkOrDispute?: boolean;
};

export type AccountTransitionDecision =
  | {
      allowed: true;
      from: AccountStatus;
      to: AccountStatus;
      effects: {
        revokeSessions: boolean;
        withdrawActiveEnrollments: boolean;
        requirePasswordReset: boolean;
      };
    }
  | { allowed: false; code: string };

export function decideAccountTransition(
  input: AccountTransitionInput
): AccountTransitionDecision {
  if (input.actor.role !== "ADMIN") {
    return { allowed: false, code: "admin_lifecycle_operator_required" };
  }

  if (input.actor.userId === input.target.userId) {
    return { allowed: false, code: "account_lifecycle_self_action_forbidden" };
  }

  if (input.target.status === "ANONYMIZED") {
    return { allowed: false, code: "account_anonymized_irreversible" };
  }

  if (input.to === "ANONYMIZED" && input.target.status !== "TERMINATED") {
    return {
      allowed: false,
      code: "account_must_be_terminated_before_anonymization",
    };
  }

  if (input.to === "ANONYMIZED" && input.hasOpenWorkOrDispute) {
    return { allowed: false, code: "account_open_work_or_dispute" };
  }

  if (
    input.target.role === "ADMIN" &&
    input.target.status === "ACTIVE" &&
    input.to !== "ACTIVE" &&
    input.activeAdminCount <= 1
  ) {
    return { allowed: false, code: "last_active_admin_protected" };
  }

  if (
    input.target.role === "TEACHER" &&
    input.to === "TERMINATED" &&
    input.target.activeOwnedCourseCount > 0
  ) {
    return {
      allowed: false,
      code: "teacher_active_courses_must_be_archived",
    };
  }

  if (
    input.target.status === "TERMINATED" &&
    input.to === "ACTIVE" &&
    !input.temporaryPasswordPrepared
  ) {
    return {
      allowed: false,
      code: "temporary_password_required_for_restore",
    };
  }

  if (input.target.status === "TERMINATED" && input.to === "ACTIVE") {
    return {
      allowed: true,
      from: input.target.status,
      to: input.to,
      effects: {
        revokeSessions: true,
        withdrawActiveEnrollments: false,
        requirePasswordReset: true,
      },
    };
  }

  if (input.target.status === "TERMINATED" && input.to === "ANONYMIZED") {
    return {
      allowed: true,
      from: input.target.status,
      to: input.to,
      effects: {
        revokeSessions: true,
        withdrawActiveEnrollments: false,
        requirePasswordReset: false,
      },
    };
  }

  if (input.target.status === "SUSPENDED" && input.to === "ACTIVE") {
    return {
      allowed: true,
      from: input.target.status,
      to: input.to,
      effects: {
        revokeSessions: true,
        withdrawActiveEnrollments: false,
        requirePasswordReset: false,
      },
    };
  }

  if (
    (input.target.status === "ACTIVE" || input.target.status === "SUSPENDED") &&
    input.to === "TERMINATED"
  ) {
    return {
      allowed: true,
      from: input.target.status,
      to: input.to,
      effects: {
        revokeSessions: true,
        withdrawActiveEnrollments: input.target.role === "STUDENT",
        requirePasswordReset: false,
      },
    };
  }

  if (input.target.status === "ACTIVE" && input.to === "SUSPENDED") {
    return {
      allowed: true,
      from: input.target.status,
      to: input.to,
      effects: {
        revokeSessions: true,
        withdrawActiveEnrollments: false,
        requirePasswordReset: false,
      },
    };
  }

  return { allowed: false, code: "account_transition_not_allowed" };
}
