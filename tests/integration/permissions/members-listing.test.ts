// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getActiveMembers,
  getActiveMembersForStudent,
  removeMember,
} from "@/lib/course/enrollment";
import {
  enrollStudent,
  setupTestCourse,
  type TestCourseContext,
} from "./_fixtures";

/**
 * Tests the canonical read paths added in P3-2 and P3-6:
 *   - getActiveMembers filters `removedAt: null` (ADR-0013 § Negative
 *     Consequences mitigation against forgetting the predicate everywhere).
 *   - getActiveMembersForStudent enforces L1 visibility at the DB SELECT
 *     layer (no studentId, no enrolledAt on the wire — CONTEXT.md § L1).
 */
describe("getActiveMembers + getActiveMembersForStudent", () => {
  let ctx: TestCourseContext;

  beforeEach(async () => {
    ctx = await setupTestCourse();
    // Enroll both fixture students.
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await enrollStudent(ctx.courseOfferingId, ctx.otherStudentUserId);
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("getActiveMembers returns both active enrollments", async () => {
    const members = await getActiveMembers(ctx.courseOfferingId);
    expect(members).toHaveLength(2);
    const ids = members.map((m) => m.student.userId).sort();
    expect(ids).toEqual([ctx.otherStudentUserId, ctx.studentUserId].sort());
  });

  it("getActiveMembers excludes a soft-deleted enrollment", async () => {
    const target = (await getActiveMembers(ctx.courseOfferingId)).find(
      (m) => m.student.userId === ctx.studentUserId
    );
    expect(target).toBeDefined();

    await removeMember({
      enrollmentId: target!.id,
      actorUserId: ctx.teacherUserId,
      actorRole: "TEACHER",
      reason: "ออกจากห้อง",
    });

    const after = await getActiveMembers(ctx.courseOfferingId);
    expect(after).toHaveLength(1);
    expect(after[0]?.student.userId).toBe(ctx.otherStudentUserId);
  });

  it("getActiveMembersForStudent does NOT include studentId or enrolledAt (L1)", async () => {
    const members = await getActiveMembersForStudent(ctx.courseOfferingId);
    expect(members).toHaveLength(2);

    for (const m of members) {
      // Allowed L1 fields
      expect(m.student).toHaveProperty("firstName");
      expect(m.student).toHaveProperty("lastName");
      // PII / non-L1 fields must be absent from the projection
      expect(m.student).not.toHaveProperty("studentId");
      expect(m.student).not.toHaveProperty("userId");
      expect(m).not.toHaveProperty("enrolledAt");
    }
  });

  it("getActiveMembersForStudent excludes soft-deleted rows (same predicate as teacher view)", async () => {
    const target = (await getActiveMembers(ctx.courseOfferingId)).find(
      (m) => m.student.userId === ctx.otherStudentUserId
    );
    await removeMember({
      enrollmentId: target!.id,
      actorUserId: ctx.teacherUserId,
      actorRole: "TEACHER",
      reason: "ลบทดสอบ",
    });

    const after = await getActiveMembersForStudent(ctx.courseOfferingId);
    expect(after).toHaveLength(1);
    expect(after[0]?.student.firstName).toBe("Alice");
  });
});
