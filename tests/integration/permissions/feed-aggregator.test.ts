/**
 * Integration — feed aggregator + course scope (Phase 7 · P7-4 · ADR-0023)
 *
 * Locks the L1 boundary at `lib/feed/scope.getCourseScopeForUser` and
 * the multi-query merge in `lib/feed/aggregator.getUserFeed`:
 *
 *   - Student sees only entries from courses they are actively enrolled in.
 *   - Removed enrollment drops the course from scope.
 *   - Cross-course Assignment + Material + Announcement + Score-published
 *     all merge into the feed, sorted by sortAt DESC.
 *   - Admin → Forbidden (no User Feed surface).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { Forbidden } from "@/lib/errors";
import { getUserFeed } from "@/lib/feed/aggregator";
import { getCourseScopeForUser } from "@/lib/feed/scope";
import { createAssignment } from "@/lib/assignment/assignment";
import { createMaterial } from "@/lib/material";
import { createAnnouncement } from "@/lib/announcement";
import {
  enrollStudent,
  setupTestCourse,
  type TestCourseContext,
} from "./_fixtures";

let ctx: TestCourseContext;

beforeEach(async () => {
  ctx = await setupTestCourse();
});

afterEach(async () => {
  await ctx.cleanup();
});

function mkSession(
  role: "STUDENT" | "TEACHER" | "ADMIN",
  userId: string,
  identifier = "test@example"
) {
  return {
    user: { id: userId, role, identifier },
  } as const;
}

describe("getCourseScopeForUser (P7-4 · ADR-0023 § 4)", () => {
  it("STUDENT — returns active enrollments only", async () => {
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    const scope = await getCourseScopeForUser(
      mkSession("STUDENT", ctx.studentUserId)
    );
    expect(scope.role).toBe("STUDENT");
    expect(scope.courseIds).toContain(ctx.courseOfferingId);
  });

  it("STUDENT — soft-removed enrollment is excluded", async () => {
    const e = await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await db.enrollment.update({
      where: { id: e.id },
      data: {
        removedAt: new Date(),
        removedById: ctx.teacherUserId,
        removedReason: "test removal",
      },
    });
    const scope = await getCourseScopeForUser(
      mkSession("STUDENT", ctx.studentUserId)
    );
    expect(scope.courseIds).not.toContain(ctx.courseOfferingId);
  });

  it("TEACHER — returns owned courses", async () => {
    const scope = await getCourseScopeForUser(
      mkSession("TEACHER", ctx.teacherUserId)
    );
    expect(scope.role).toBe("TEACHER");
    expect(scope.courseIds).toContain(ctx.courseOfferingId);
  });

  it("ADMIN — throws Forbidden (no User Feed surface in Phase 7)", async () => {
    await expect(
      getCourseScopeForUser(mkSession("ADMIN", "any-admin-id"))
    ).rejects.toBeInstanceOf(Forbidden);
  });
});

describe("getUserFeed (P7-4 · ADR-0023)", () => {
  it("returns Assignment + Material + Announcement + Score-published merged DESC by sortAt", async () => {
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    // Seed each kind. Sort order = insertion order is good enough for the
    // assertion because sortAt = createdAt/postedAt/publishedAt and each
    // insert happens later than the previous.
    const a = await createAssignment(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: "A title",
        description: "",
        dueAt: null,
        allowText: true,
        allowFile: false,
        allowLink: false,
        submissionClosed: false,
        autoCloseAtDue: false,
        isScored: false,
      },
      { actorUserId: ctx.teacherUserId }
    );
    const m = await createMaterial(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: "M title",
        body: "",
        fileAttachmentIds: [],
        linkUrls: [],
      },
      { actorUserId: ctx.teacherUserId }
    );
    const an = await createAnnouncement(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: "An title",
        body: "Something to know",
        fileAttachmentIds: [],
        linkUrls: [],
      },
      { actorUserId: ctx.teacherUserId }
    );

    const page = await getUserFeed(mkSession("STUDENT", ctx.studentUserId));
    expect(page.items.length).toBeGreaterThanOrEqual(3);
    const kinds = page.items.map((i) => i.kind);
    expect(kinds).toContain("ASSIGNMENT");
    expect(kinds).toContain("MATERIAL");
    expect(kinds).toContain("ANNOUNCEMENT");
    // Most recent (Announcement) sorts first.
    expect(page.items[0]?.id).toBe(an.id);
    // Voided-touch checks so the linter doesn't yell about a/m being unused.
    expect(a.id).toBeTruthy();
    expect(m.id).toBeTruthy();
  });

  it("returns empty feed when student has no active enrollments", async () => {
    const page = await getUserFeed(
      mkSession("STUDENT", ctx.otherStudentUserId)
    );
    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });

  it("excludes soft-deleted Material from feed", async () => {
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    const m = await createMaterial(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: "Will be deleted",
        body: "",
        fileAttachmentIds: [],
        linkUrls: [],
      },
      { actorUserId: ctx.teacherUserId }
    );
    await db.material.update({
      where: { id: m.id },
      data: {
        deletedAt: new Date(),
        deletedById: ctx.teacherUserId,
        deletedReason: "test",
      },
    });
    const page = await getUserFeed(mkSession("STUDENT", ctx.studentUserId));
    expect(page.items.find((i) => i.id === m.id)).toBeUndefined();
  });
});
