import { describe, expect, it } from "vitest";
import { decideAccountTransition } from "@/lib/account/lifecycle-policy";

describe("decideAccountTransition", () => {
  it("allows an Admin to suspend an active account and revokes its sessions", () => {
    expect(
      decideAccountTransition({
        actor: { userId: "admin-1", role: "ADMIN" },
        target: {
          userId: "student-1",
          role: "STUDENT",
          status: "ACTIVE",
          activeOwnedCourseCount: 0,
        },
        to: "SUSPENDED",
        activeAdminCount: 1,
        temporaryPasswordPrepared: false,
      })
    ).toEqual({
      allowed: true,
      from: "ACTIVE",
      to: "SUSPENDED",
      effects: {
        revokeSessions: true,
        withdrawActiveEnrollments: false,
        requirePasswordReset: false,
      },
    });
  });

  it("rejects a direct lifecycle transition by a non-Admin", () => {
    expect(
      decideAccountTransition({
        actor: { userId: "teacher-1", role: "TEACHER" },
        target: {
          userId: "student-1",
          role: "STUDENT",
          status: "ACTIVE",
          activeOwnedCourseCount: 0,
        },
        to: "SUSPENDED",
        activeAdminCount: 1,
        temporaryPasswordPrepared: false,
      })
    ).toEqual({
      allowed: false,
      code: "admin_lifecycle_operator_required",
    });
  });

  it("rejects an Admin changing their own lifecycle state", () => {
    expect(
      decideAccountTransition({
        actor: { userId: "admin-1", role: "ADMIN" },
        target: {
          userId: "admin-1",
          role: "ADMIN",
          status: "ACTIVE",
          activeOwnedCourseCount: 0,
        },
        to: "SUSPENDED",
        activeAdminCount: 2,
        temporaryPasswordPrepared: false,
      })
    ).toEqual({
      allowed: false,
      code: "account_lifecycle_self_action_forbidden",
    });
  });

  it("protects the last active Admin from an access-closing transition", () => {
    expect(
      decideAccountTransition({
        actor: { userId: "admin-1", role: "ADMIN" },
        target: {
          userId: "admin-2",
          role: "ADMIN",
          status: "ACTIVE",
          activeOwnedCourseCount: 0,
        },
        to: "SUSPENDED",
        activeAdminCount: 1,
        temporaryPasswordPrepared: false,
      })
    ).toEqual({ allowed: false, code: "last_active_admin_protected" });
  });

  it("requires a Teacher to archive owned courses before termination", () => {
    expect(
      decideAccountTransition({
        actor: { userId: "admin-1", role: "ADMIN" },
        target: {
          userId: "teacher-1",
          role: "TEACHER",
          status: "ACTIVE",
          activeOwnedCourseCount: 1,
        },
        to: "TERMINATED",
        activeAdminCount: 1,
        temporaryPasswordPrepared: false,
      })
    ).toEqual({
      allowed: false,
      code: "teacher_active_courses_must_be_archived",
    });
  });

  it("terminates a Student by revoking sessions and withdrawing active enrollments", () => {
    expect(
      decideAccountTransition({
        actor: { userId: "admin-1", role: "ADMIN" },
        target: {
          userId: "student-1",
          role: "STUDENT",
          status: "ACTIVE",
          activeOwnedCourseCount: 0,
        },
        to: "TERMINATED",
        activeAdminCount: 1,
        temporaryPasswordPrepared: false,
      })
    ).toEqual({
      allowed: true,
      from: "ACTIVE",
      to: "TERMINATED",
      effects: {
        revokeSessions: true,
        withdrawActiveEnrollments: true,
        requirePasswordReset: false,
      },
    });
  });

  it("requires a temporary password before restoring a terminated account", () => {
    expect(
      decideAccountTransition({
        actor: { userId: "admin-1", role: "ADMIN" },
        target: {
          userId: "student-1",
          role: "STUDENT",
          status: "TERMINATED",
          activeOwnedCourseCount: 0,
        },
        to: "ACTIVE",
        activeAdminCount: 1,
        temporaryPasswordPrepared: false,
      })
    ).toEqual({
      allowed: false,
      code: "temporary_password_required_for_restore",
    });
  });

  it("restores a terminated account with a prepared temporary password", () => {
    expect(
      decideAccountTransition({
        actor: { userId: "admin-1", role: "ADMIN" },
        target: {
          userId: "student-1",
          role: "STUDENT",
          status: "TERMINATED",
          activeOwnedCourseCount: 0,
        },
        to: "ACTIVE",
        activeAdminCount: 1,
        temporaryPasswordPrepared: true,
      })
    ).toEqual({
      allowed: true,
      from: "TERMINATED",
      to: "ACTIVE",
      effects: {
        revokeSessions: true,
        withdrawActiveEnrollments: false,
        requirePasswordReset: true,
      },
    });
  });

  it("never restores an anonymized account", () => {
    expect(
      decideAccountTransition({
        actor: { userId: "admin-1", role: "ADMIN" },
        target: {
          userId: "student-1",
          role: "STUDENT",
          status: "ANONYMIZED",
          activeOwnedCourseCount: 0,
        },
        to: "ACTIVE",
        activeAdminCount: 1,
        temporaryPasswordPrepared: true,
      })
    ).toEqual({ allowed: false, code: "account_anonymized_irreversible" });
  });

  it("allows anonymization only after termination", () => {
    expect(
      decideAccountTransition({
        actor: { userId: "admin-1", role: "ADMIN" },
        target: {
          userId: "student-1",
          role: "STUDENT",
          status: "TERMINATED",
          activeOwnedCourseCount: 0,
        },
        to: "ANONYMIZED",
        activeAdminCount: 1,
        temporaryPasswordPrepared: false,
      })
    ).toEqual({
      allowed: true,
      from: "TERMINATED",
      to: "ANONYMIZED",
      effects: {
        revokeSessions: true,
        withdrawActiveEnrollments: false,
        requirePasswordReset: false,
      },
    });
  });

  it("rejects anonymization before an account is terminated", () => {
    expect(
      decideAccountTransition({
        actor: { userId: "admin-1", role: "ADMIN" },
        target: {
          userId: "student-1",
          role: "STUDENT",
          status: "ACTIVE",
          activeOwnedCourseCount: 0,
        },
        to: "ANONYMIZED",
        activeAdminCount: 1,
        temporaryPasswordPrepared: false,
      })
    ).toEqual({
      allowed: false,
      code: "account_must_be_terminated_before_anonymization",
    });
  });

  it("reactivates a suspended account without requiring a password reset", () => {
    expect(
      decideAccountTransition({
        actor: { userId: "admin-1", role: "ADMIN" },
        target: {
          userId: "teacher-1",
          role: "TEACHER",
          status: "SUSPENDED",
          activeOwnedCourseCount: 2,
        },
        to: "ACTIVE",
        activeAdminCount: 1,
        temporaryPasswordPrepared: false,
      })
    ).toEqual({
      allowed: true,
      from: "SUSPENDED",
      to: "ACTIVE",
      effects: {
        revokeSessions: true,
        withdrawActiveEnrollments: false,
        requirePasswordReset: false,
      },
    });
  });

  it("blocks anonymization while work or a dispute is still open", () => {
    expect(
      decideAccountTransition({
        actor: { userId: "admin-1", role: "ADMIN" },
        target: {
          userId: "student-1",
          role: "STUDENT",
          status: "TERMINATED",
          activeOwnedCourseCount: 0,
        },
        to: "ANONYMIZED",
        activeAdminCount: 1,
        temporaryPasswordPrepared: false,
        hasOpenWorkOrDispute: true,
      })
    ).toEqual({
      allowed: false,
      code: "account_open_work_or_dispute",
    });
  });
});
