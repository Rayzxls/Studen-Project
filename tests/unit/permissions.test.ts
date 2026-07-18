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

describe("can.mutateSession (Phase 4, P4-3)", () => {
  const sessionRow = { course: { teacherId: "t1" } };

  it("allows the owning TEACHER", () => {
    expect(can.mutateSession(mkSession("TEACHER", "t1"), sessionRow)).toBe(
      true
    );
  });

  it("rejects a different TEACHER", () => {
    expect(can.mutateSession(mkSession("TEACHER", "t2"), sessionRow)).toBe(
      false
    );
  });

  it("rejects ADMIN (Phase 4 scopes attendance writes to course owner)", () => {
    expect(can.mutateSession(mkSession("ADMIN", "t1"), sessionRow)).toBe(false);
  });

  it("rejects STUDENT even when id collides with teacherId", () => {
    expect(can.mutateSession(mkSession("STUDENT", "t1"), sessionRow)).toBe(
      false
    );
  });

  it("is pure — does not depend on cancelledAt (lib layer enforces state)", () => {
    // The predicate's contract is "who", not "current state". The lib's
    // bulkMarkAttendance / cancelSession check cancelledAt and throw Conflict.
    expect(can.mutateSession(mkSession("TEACHER", "t1"), sessionRow)).toBe(
      true
    );
  });
});

describe("can.mutateScoreItem (Phase 5, P5-3)", () => {
  const item = { course: { teacherId: "t1" } };

  it("allows the owning TEACHER", () => {
    expect(can.mutateScoreItem(mkSession("TEACHER", "t1"), item)).toBe(true);
  });

  it("rejects a different TEACHER", () => {
    expect(can.mutateScoreItem(mkSession("TEACHER", "t2"), item)).toBe(false);
  });

  it("rejects ADMIN (Phase 5 scopes scoring writes to course owner)", () => {
    expect(can.mutateScoreItem(mkSession("ADMIN", "t1"), item)).toBe(false);
  });

  it("rejects STUDENT even when id collides with teacherId", () => {
    expect(can.mutateScoreItem(mkSession("STUDENT", "t1"), item)).toBe(false);
  });

  it("is pure — does not depend on publishedAt (lib layer enforces lifecycle)", () => {
    // ADR-0018: the publish gate / field-class dispatch / reason gate all
    // live in lib/scoring/score-item.ts. This predicate is "who", not "what state".
    expect(can.mutateScoreItem(mkSession("TEACHER", "t1"), item)).toBe(true);
  });

  it("matches mutateSession shape exactly (consistency across course-owned entities)", () => {
    // Phase 4 sessionRow shape and Phase 5 scoreItem shape are isomorphic
    // for authz purposes: both wrap `course.teacherId`. The predicates
    // should agree on every Session-Item-Teacher triple.
    const t1 = mkSession("TEACHER", "t1");
    const t2 = mkSession("TEACHER", "t2");
    const sessionRow = { course: { teacherId: "t1" } };
    expect(can.mutateScoreItem(t1, item)).toBe(
      can.mutateSession(t1, sessionRow)
    );
    expect(can.mutateScoreItem(t2, item)).toBe(
      can.mutateSession(t2, sessionRow)
    );
  });
});

// ─────────────────────────────────────────────────────────────
// Phase 6, P6-4 — Assignment / Submission / Comment / Upload predicates
// ─────────────────────────────────────────────────────────────

describe("can.mutateAssignment (Phase 6, P6-4)", () => {
  const assignment = { course: { teacherId: "t1" } };

  it("owning teacher can mutate", () => {
    expect(can.mutateAssignment(mkSession("TEACHER", "t1"), assignment)).toBe(
      true
    );
  });

  it("non-owning teacher cannot mutate", () => {
    expect(can.mutateAssignment(mkSession("TEACHER", "t2"), assignment)).toBe(
      false
    );
  });

  it("ADMIN cannot mutate (mirrors ownsCourse / mutateScoreItem posture)", () => {
    expect(can.mutateAssignment(mkSession("ADMIN"), assignment)).toBe(false);
  });

  it("STUDENT cannot mutate", () => {
    expect(can.mutateAssignment(mkSession("STUDENT", "s1"), assignment)).toBe(
      false
    );
  });

  it("agrees with mutateScoreItem on the same (course teacher) pair (cross-predicate consistency)", () => {
    const t1 = mkSession("TEACHER", "t1");
    const t2 = mkSession("TEACHER", "t2");
    const item = { course: { teacherId: "t1" } };
    expect(can.mutateAssignment(t1, assignment)).toBe(
      can.mutateScoreItem(t1, item)
    );
    expect(can.mutateAssignment(t2, assignment)).toBe(
      can.mutateScoreItem(t2, item)
    );
  });
});

describe("can.submitTo (Phase 6, P6-4)", () => {
  const activeEnrollment = { studentId: "s1", removedAt: null };
  const removedEnrollment = {
    studentId: "s1",
    removedAt: new Date("2026-01-01T00:00:00Z"),
  };

  it("active student matches own enrollment → true", () => {
    expect(can.submitTo(mkSession("STUDENT", "s1"), activeEnrollment)).toBe(
      true
    );
  });

  it("non-owner student → false", () => {
    expect(can.submitTo(mkSession("STUDENT", "s2"), activeEnrollment)).toBe(
      false
    );
  });

  it("removed enrollment → false (ADR-0013 — soft-deleted lose write privileges)", () => {
    expect(can.submitTo(mkSession("STUDENT", "s1"), removedEnrollment)).toBe(
      false
    );
  });

  it("no enrollment row → false", () => {
    expect(can.submitTo(mkSession("STUDENT", "s1"), null)).toBe(false);
  });

  it("TEACHER cannot submit (teachers grade, they don't submit)", () => {
    expect(can.submitTo(mkSession("TEACHER", "t1"), activeEnrollment)).toBe(
      false
    );
  });

  it("ADMIN cannot submit", () => {
    expect(can.submitTo(mkSession("ADMIN"), activeEnrollment)).toBe(false);
  });
});

describe("can.viewSubmission (Phase 6, P6-4 · L1 boundary)", () => {
  const submission = {
    enrollment: { studentId: "s1" },
    assignment: { course: { teacherId: "t1" } },
  };

  it("owning student → true", () => {
    expect(can.viewSubmission(mkSession("STUDENT", "s1"), submission)).toBe(
      true
    );
  });

  it("peer student → false (L1 boundary)", () => {
    expect(can.viewSubmission(mkSession("STUDENT", "s2"), submission)).toBe(
      false
    );
  });

  it("owning teacher → true", () => {
    expect(can.viewSubmission(mkSession("TEACHER", "t1"), submission)).toBe(
      true
    );
  });

  it("non-owning teacher → false (other course's teacher)", () => {
    expect(can.viewSubmission(mkSession("TEACHER", "t2"), submission)).toBe(
      false
    );
  });

  it("ADMIN cannot directly view (submission content moderation out of scope Phase 6)", () => {
    expect(can.viewSubmission(mkSession("ADMIN"), submission)).toBe(false);
  });
});

describe("can.moderateComment (Phase 6, P6-4 · Q5 matrix)", () => {
  it("owning teacher → true (Important tier downstream)", () => {
    expect(
      can.moderateComment(mkSession("TEACHER", "t1"), {
        owningCourseTeacherId: "t1",
      })
    ).toBe(true);
  });

  it("non-owning teacher → false", () => {
    expect(
      can.moderateComment(mkSession("TEACHER", "t2"), {
        owningCourseTeacherId: "t1",
      })
    ).toBe(false);
  });

  it("ADMIN → true for any course (PRIVATE escalates to Critical at the audit fire site)", () => {
    expect(
      can.moderateComment(mkSession("ADMIN"), {
        owningCourseTeacherId: "t1",
      })
    ).toBe(true);
  });

  it("ADMIN can still moderate when course-host resolution is unknown (MATERIAL/ANNOUNCEMENT host model lands Phase 7+)", () => {
    expect(
      can.moderateComment(mkSession("ADMIN"), {
        owningCourseTeacherId: null,
      })
    ).toBe(true);
  });

  it("TEACHER cannot moderate when host resolution failed (null teacherId)", () => {
    expect(
      can.moderateComment(mkSession("TEACHER", "t1"), {
        owningCourseTeacherId: null,
      })
    ).toBe(false);
  });

  it("STUDENT cannot moderate (own self-delete goes through selfDeleteComment, not this predicate)", () => {
    expect(
      can.moderateComment(mkSession("STUDENT", "s1"), {
        owningCourseTeacherId: "t1",
      })
    ).toBe(false);
  });
});

describe("can.uploadToAssignment (Phase 6, P6-4 · ADR-0021 § 1 step 2)", () => {
  const assignment = { course: { teacherId: "t1" } };

  it("owning teacher → true", () => {
    expect(can.uploadToAssignment(mkSession("TEACHER", "t1"), assignment)).toBe(
      true
    );
  });

  it("non-owning teacher → false", () => {
    expect(can.uploadToAssignment(mkSession("TEACHER", "t2"), assignment)).toBe(
      false
    );
  });

  it("STUDENT → false (Phase 6 only allows teacher upload to Assignment brief; student SUBMISSION upload wires in P7-0b storage routes)", () => {
    expect(can.uploadToAssignment(mkSession("STUDENT", "s1"), assignment)).toBe(
      false
    );
  });

  it("ADMIN → false (admin does not create content per CLAUDE.md hard rule)", () => {
    expect(can.uploadToAssignment(mkSession("ADMIN"), assignment)).toBe(false);
  });
});

describe("can.uploadToSubmission (Phase 7 · P7-0b · ADR-0021 + ADR-0022 sibling)", () => {
  const submission = {
    enrollment: { studentId: "s1", removedAt: null as Date | null },
  };

  it("owning student of active enrollment → true", () => {
    expect(can.uploadToSubmission(mkSession("STUDENT", "s1"), submission)).toBe(
      true
    );
  });

  it("different student → false", () => {
    expect(can.uploadToSubmission(mkSession("STUDENT", "s2"), submission)).toBe(
      false
    );
  });

  it("owning student but enrollment removed → false (ADR-0013 soft-delete blocks upload)", () => {
    const removed = {
      enrollment: { studentId: "s1", removedAt: new Date("2026-01-01") },
    };
    expect(can.uploadToSubmission(mkSession("STUDENT", "s1"), removed)).toBe(
      false
    );
  });

  it("TEACHER → false (teacher uploads to ASSIGNMENT scope, not SUBMISSION)", () => {
    expect(can.uploadToSubmission(mkSession("TEACHER", "t1"), submission)).toBe(
      false
    );
  });

  it("ADMIN → false (admin does not create student content per CLAUDE.md hard rule)", () => {
    expect(can.uploadToSubmission(mkSession("ADMIN"), submission)).toBe(false);
  });
});

describe("can.uploadToQuiz (Quiz C5a private attachments)", () => {
  const quiz = { course: { teacherId: "t1" } };

  it("allows only the teacher who owns the course", () => {
    expect(can.uploadToQuiz(mkSession("TEACHER", "t1"), quiz)).toBe(true);
    expect(can.uploadToQuiz(mkSession("TEACHER", "t2"), quiz)).toBe(false);
  });

  it("keeps students and read-only admins outside the upload boundary", () => {
    expect(can.uploadToQuiz(mkSession("STUDENT", "t1"), quiz)).toBe(false);
    expect(can.uploadToQuiz(mkSession("ADMIN", "t1"), quiz)).toBe(false);
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
