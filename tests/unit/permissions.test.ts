import { describe, it, expect } from "vitest";
import { can, type Session } from "@/lib/auth/permissions";

function mkSession(role: "ADMIN" | "TEACHER" | "STUDENT", id = "u1"): Session {
  return {
    user: {
      id,
      role,
      identifier: id,
      mustResetPwd: false,
    },
  };
}

describe("can.viewAuditLog", () => {
  it("allows ADMIN only", () => {
    expect(can.viewAuditLog(mkSession("ADMIN"))).toBe(true);
    expect(can.viewAuditLog(mkSession("TEACHER"))).toBe(false);
    expect(can.viewAuditLog(mkSession("STUDENT"))).toBe(false);
  });
});

describe("can.viewUserData", () => {
  it("allows self for any role", () => {
    const s = mkSession("STUDENT", "alice");
    expect(can.viewUserData(s, "alice")).toBe(true);
    expect(can.viewUserData(s, "bob")).toBe(false);
  });

  it("allows ADMIN to view any user", () => {
    const admin = mkSession("ADMIN", "admin1");
    expect(can.viewUserData(admin, "admin1")).toBe(true);
    expect(can.viewUserData(admin, "alice")).toBe(true);
    expect(can.viewUserData(admin, "bob")).toBe(true);
  });

  it("forbids TEACHER from viewing other users (Phase 1)", () => {
    const teacher = mkSession("TEACHER", "t1");
    expect(can.viewUserData(teacher, "t1")).toBe(true);
    expect(can.viewUserData(teacher, "other-teacher")).toBe(false);
    expect(can.viewUserData(teacher, "alice")).toBe(false);
  });
});

describe("can.changeOwnPassword", () => {
  it("allows self only", () => {
    const s = mkSession("STUDENT", "alice");
    expect(can.changeOwnPassword(s, "alice")).toBe(true);
    expect(can.changeOwnPassword(s, "bob")).toBe(false);
  });
});

describe("can.resetUserPassword (Phase 1)", () => {
  it("ADMIN can reset anyone", () => {
    const admin = mkSession("ADMIN");
    expect(can.resetUserPassword(admin, "STUDENT")).toBe(true);
    expect(can.resetUserPassword(admin, "TEACHER")).toBe(true);
  });

  it("TEACHER cannot reset others in Phase 1 (Phase 2+ adds course scope)", () => {
    const teacher = mkSession("TEACHER");
    expect(can.resetUserPassword(teacher, "STUDENT")).toBe(false);
  });

  it("STUDENT cannot reset others", () => {
    const student = mkSession("STUDENT");
    expect(can.resetUserPassword(student, "STUDENT")).toBe(false);
  });
});

describe("can.importTeachersCSV", () => {
  it("ADMIN only", () => {
    expect(can.importTeachersCSV(mkSession("ADMIN"))).toBe(true);
    expect(can.importTeachersCSV(mkSession("TEACHER"))).toBe(false);
    expect(can.importTeachersCSV(mkSession("STUDENT"))).toBe(false);
  });
});

describe("can.toggleUserActive", () => {
  it("ADMIN only", () => {
    expect(can.toggleUserActive(mkSession("ADMIN"))).toBe(true);
    expect(can.toggleUserActive(mkSession("TEACHER"))).toBe(false);
    expect(can.toggleUserActive(mkSession("STUDENT"))).toBe(false);
  });
});

describe("can.ownsCourse (ADR-0013, P3-3)", () => {
  const course = { teacherId: "t1" };

  it("allows the owning TEACHER", () => {
    expect(can.ownsCourse(mkSession("TEACHER", "t1"), course)).toBe(true);
  });

  it("rejects a different TEACHER", () => {
    expect(can.ownsCourse(mkSession("TEACHER", "t2"), course)).toBe(false);
  });

  it("rejects ADMIN (admin moderation is a separate predicate)", () => {
    expect(can.ownsCourse(mkSession("ADMIN", "t1"), course)).toBe(false);
  });

  it("rejects STUDENT even when id collides with teacherId", () => {
    expect(can.ownsCourse(mkSession("STUDENT", "t1"), course)).toBe(false);
  });
});

describe("can.isActiveCourseMember (ADR-0013, P3-3)", () => {
  it("allows the STUDENT on an active enrollment", () => {
    expect(
      can.isActiveCourseMember(mkSession("STUDENT", "alice"), {
        studentId: "alice",
        removedAt: null,
      })
    ).toBe(true);
  });

  it("rejects a STUDENT whose Enrollment is soft-deleted", () => {
    expect(
      can.isActiveCourseMember(mkSession("STUDENT", "alice"), {
        studentId: "alice",
        removedAt: new Date("2026-05-01"),
      })
    ).toBe(false);
  });

  it("rejects a different STUDENT (id mismatch)", () => {
    expect(
      can.isActiveCourseMember(mkSession("STUDENT", "bob"), {
        studentId: "alice",
        removedAt: null,
      })
    ).toBe(false);
  });

  it("rejects TEACHER even when ids match (wrong role)", () => {
    expect(
      can.isActiveCourseMember(mkSession("TEACHER", "alice"), {
        studentId: "alice",
        removedAt: null,
      })
    ).toBe(false);
  });

  it("rejects ADMIN", () => {
    expect(
      can.isActiveCourseMember(mkSession("ADMIN", "alice"), {
        studentId: "alice",
        removedAt: null,
      })
    ).toBe(false);
  });
});

describe("L1 visibility (Phase 1) — students never see others", () => {
  it("STUDENT cannot view audit logs", () => {
    expect(can.viewAuditLog(mkSession("STUDENT"))).toBe(false);
    expect(can.viewAllAuditLogs(mkSession("STUDENT"))).toBe(false);
  });

  it("STUDENT cannot view other students' data", () => {
    const alice = mkSession("STUDENT", "alice");
    expect(can.viewUserData(alice, "bob")).toBe(false);
    expect(can.viewUserData(alice, "teacher1")).toBe(false);
  });
});
