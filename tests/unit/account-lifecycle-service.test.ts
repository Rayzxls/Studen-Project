import { describe, expect, it, vi } from "vitest";
import {
  suspendOrReactivateAccount,
  type AccountLifecycleRepository,
} from "@/lib/account/lifecycle-service";

function createRepository(
  status: "ACTIVE" | "SUSPENDED" | "TERMINATED" = "ACTIVE"
): AccountLifecycleRepository {
  return {
    loadContext: vi.fn().mockResolvedValue({
      target: {
        userId: "student-1",
        role: "STUDENT",
        status,
        activeOwnedCourseCount: 0,
      },
      activeAdminCount: 2,
      hasOpenWorkOrDispute: false,
    }),
    commitTransition: vi.fn().mockResolvedValue(undefined),
  };
}

const baseCommand = {
  actor: { userId: "admin-1", role: "ADMIN" as const },
  targetUserId: "student-1",
  to: "SUSPENDED" as const,
  internalReason: "Repeated security policy violation",
  userMessage: "Your account is temporarily unavailable.",
};

describe("suspendOrReactivateAccount", () => {
  it("fails closed before loading data when mutations are disabled", async () => {
    const repository = createRepository();

    await expect(
      suspendOrReactivateAccount(baseCommand, {
        repository,
        mutationsEnabled: false,
      })
    ).rejects.toMatchObject({ code: "account_lifecycle_mutations_disabled" });

    expect(repository.loadContext).not.toHaveBeenCalled();
    expect(repository.commitTransition).not.toHaveBeenCalled();
  });

  it("requires separate internal and user-facing explanations", async () => {
    const repository = createRepository();

    await expect(
      suspendOrReactivateAccount(
        { ...baseCommand, internalReason: " ", userMessage: "no" },
        { repository, mutationsEnabled: true }
      )
    ).rejects.toMatchObject({
      code: "validation_error",
      errors: {
        internalReason: "account_lifecycle_internal_reason_invalid",
        userMessage: "account_lifecycle_user_message_invalid",
      },
    });

    expect(repository.loadContext).not.toHaveBeenCalled();
    expect(repository.commitTransition).not.toHaveBeenCalled();
  });

  it("persists an allowed suspension through one atomic repository call", async () => {
    const repository = createRepository();
    const occurredAt = new Date("2026-07-15T02:00:00.000Z");

    await expect(
      suspendOrReactivateAccount(baseCommand, {
        repository,
        mutationsEnabled: true,
        now: () => occurredAt,
      })
    ).resolves.toMatchObject({
      allowed: true,
      from: "ACTIVE",
      to: "SUSPENDED",
      effects: { revokeSessions: true },
    });

    expect(repository.commitTransition).toHaveBeenCalledOnce();
    expect(repository.commitTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        internalReason: baseCommand.internalReason,
        userMessage: baseCommand.userMessage,
        occurredAt,
      })
    );
  });

  it("reactivates only a suspended account", async () => {
    const repository = createRepository("SUSPENDED");

    await expect(
      suspendOrReactivateAccount(
        { ...baseCommand, to: "ACTIVE" },
        { repository, mutationsEnabled: true }
      )
    ).resolves.toMatchObject({ from: "SUSPENDED", to: "ACTIVE" });

    expect(repository.commitTransition).toHaveBeenCalledOnce();
  });

  it("does not use the reactivate flow to restore a terminated account", async () => {
    const repository = createRepository("TERMINATED");

    await expect(
      suspendOrReactivateAccount(
        { ...baseCommand, to: "ACTIVE" },
        { repository, mutationsEnabled: true }
      )
    ).rejects.toMatchObject({
      code: "temporary_password_required_for_restore",
    });

    expect(repository.commitTransition).not.toHaveBeenCalled();
  });

  it("preserves self-action protection before committing", async () => {
    const repository = createRepository();

    await expect(
      suspendOrReactivateAccount(
        {
          ...baseCommand,
          actor: { userId: "student-1", role: "ADMIN" },
        },
        { repository, mutationsEnabled: true }
      )
    ).rejects.toMatchObject({
      code: "account_lifecycle_self_action_forbidden",
    });

    expect(repository.commitTransition).not.toHaveBeenCalled();
  });
});
