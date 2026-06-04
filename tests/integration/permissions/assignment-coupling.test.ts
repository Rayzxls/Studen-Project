/**
 * Integration — Assignment ↔ ScoreItem coupling (Phase 6 · ADR-0019)
 *
 * Exercises the synchronous atomic coupling + the toggle 3-state matrix
 * against the real Neon dev DB:
 *   - createAssignment(isScored=true) → ScoreItem materialised in same tx
 *   - flip false→true → coupling at flip-time
 *   - flip true→false → draft+0 atomic delete · draft+N block · published block
 *   - non-toggle field edits — class A passes, weight/fullScore rejected
 *     (those route through lib/scoring.updateScoreItem)
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { Conflict, ValidationError } from "@/lib/errors";
import {
  createAssignment,
  deleteAssignment,
  updateAssignment,
} from "@/lib/assignment/assignment";
import { publishScoreItem } from "@/lib/scoring/score-item";
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

describe("createAssignment — atomic ScoreItem coupling (ADR-0019 § 1)", () => {
  it("creates Assignment without ScoreItem when isScored=false", async () => {
    const a = await createAssignment(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: "Quiz 1",
        description: "",
        allowText: true,
        allowFile: false,
        allowLink: false,
        isScored: false,
      },
      { actorUserId: ctx.teacherUserId }
    );
    expect(a.isScored).toBe(false);
    expect(a.scoreItemId).toBeNull();
  });

  it("creates Assignment + linked ScoreItem in same tx when isScored=true", async () => {
    const a = await createAssignment(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: "Quiz 2",
        description: "",
        allowText: true,
        allowFile: false,
        allowLink: false,
        isScored: true,
        weight: 3000,
        fullScore: 20,
      },
      { actorUserId: ctx.teacherUserId }
    );
    expect(a.scoreItemId).not.toBeNull();
    const si = await db.scoreItem.findUnique({
      where: { id: a.scoreItemId! },
      select: { source: true, weight: true, fullScore: true, name: true },
    });
    expect(si).toEqual({
      source: "ASSIGNMENT_LINKED",
      weight: 3000,
      fullScore: 20,
      name: "Quiz 2",
    });
  });

  it("rejects when not the course owner (Forbidden)", async () => {
    await expect(
      createAssignment(
        {
          courseOfferingId: ctx.courseOfferingId,
          title: "X",
          description: "",
          allowText: true,
          allowFile: false,
          allowLink: false,
          isScored: false,
        },
        { actorUserId: ctx.otherTeacherUserId }
      )
    ).rejects.toThrow();
  });
});

describe("updateAssignment — toggle dispatch (ADR-0019 § 5)", () => {
  it("flip false → true creates a ScoreItem inline", async () => {
    const a = await createAssignment(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: "Toggle test",
        description: "",
        allowText: true,
        allowFile: false,
        allowLink: false,
        isScored: false,
      },
      { actorUserId: ctx.teacherUserId }
    );
    expect(a.scoreItemId).toBeNull();

    const flipped = await updateAssignment(
      a.id,
      { isScored: true, weight: 2000, fullScore: 50 },
      { actorUserId: ctx.teacherUserId }
    );
    expect(flipped.isScored).toBe(true);
    expect(flipped.scoreItemId).not.toBeNull();
  });

  it("flip true → false on a draft + 0 entries deletes ScoreItem (Verbose, no audit)", async () => {
    const a = await createAssignment(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: "Toggle off",
        description: "",
        allowText: true,
        allowFile: false,
        allowLink: false,
        isScored: true,
        weight: 1500,
        fullScore: 10,
      },
      { actorUserId: ctx.teacherUserId }
    );
    const beforeId = a.scoreItemId!;

    const flippedOff = await updateAssignment(
      a.id,
      { isScored: false },
      { actorUserId: ctx.teacherUserId }
    );
    expect(flippedOff.isScored).toBe(false);
    expect(flippedOff.scoreItemId).toBeNull();
    const orphan = await db.scoreItem.findUnique({ where: { id: beforeId } });
    expect(orphan).toBeNull();
  });

  it("flip true → false on a draft with entries throws assignment_has_scored_entries", async () => {
    const a = await createAssignment(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: "Has entries",
        description: "",
        allowText: true,
        allowFile: false,
        allowLink: false,
        isScored: true,
        weight: 2500,
        fullScore: 30,
      },
      { actorUserId: ctx.teacherUserId }
    );
    const enr = await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await db.scoreEntry.create({
      data: {
        scoreItemId: a.scoreItemId!,
        enrollmentId: enr.id,
        value: 25,
        markedById: ctx.teacherUserId,
      },
    });

    await expect(
      updateAssignment(
        a.id,
        { isScored: false },
        { actorUserId: ctx.teacherUserId }
      )
    ).rejects.toBeInstanceOf(Conflict);
  });

  it("flip true → false on a published ScoreItem throws linked_scoreitem_published", async () => {
    const a = await createAssignment(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: "Published",
        description: "",
        allowText: true,
        allowFile: false,
        allowLink: false,
        isScored: true,
        weight: 10_000,
        fullScore: 100,
      },
      { actorUserId: ctx.teacherUserId }
    );
    await publishScoreItem(a.scoreItemId!, { actorUserId: ctx.teacherUserId });

    await expect(
      updateAssignment(
        a.id,
        { isScored: false },
        { actorUserId: ctx.teacherUserId }
      )
    ).rejects.toBeInstanceOf(Conflict);
  });

  it("non-toggle update rejects weight/fullScore in patch (route through lib/scoring)", async () => {
    const a = await createAssignment(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: "X",
        description: "",
        allowText: true,
        allowFile: false,
        allowLink: false,
        isScored: true,
        weight: 5000,
        fullScore: 50,
      },
      { actorUserId: ctx.teacherUserId }
    );
    await expect(
      updateAssignment(
        a.id,
        { weight: 6000 },
        { actorUserId: ctx.teacherUserId }
      )
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("flip on requires weight + fullScore — missing weight throws ValidationError", async () => {
    const a = await createAssignment(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: "Missing weight",
        description: "",
        allowText: true,
        allowFile: false,
        allowLink: false,
        isScored: false,
      },
      { actorUserId: ctx.teacherUserId }
    );
    await expect(
      updateAssignment(
        a.id,
        { isScored: true, fullScore: 10 },
        { actorUserId: ctx.teacherUserId }
      )
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("deleteAssignment — coupling escape (ADR-0019 § 5)", () => {
  it("deletes Assignment + linked draft+0-entries ScoreItem cleanly", async () => {
    const a = await createAssignment(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: "Clean delete",
        description: "",
        allowText: true,
        allowFile: false,
        allowLink: false,
        isScored: true,
        weight: 2000,
        fullScore: 25,
      },
      { actorUserId: ctx.teacherUserId }
    );
    const siId = a.scoreItemId!;
    await deleteAssignment(a.id, { actorUserId: ctx.teacherUserId });
    expect(await db.assignment.findUnique({ where: { id: a.id } })).toBeNull();
    expect(await db.scoreItem.findUnique({ where: { id: siId } })).toBeNull();
  });

  it("blocks delete when linked ScoreItem is published", async () => {
    const a = await createAssignment(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: "Cannot delete",
        description: "",
        allowText: true,
        allowFile: false,
        allowLink: false,
        isScored: true,
        weight: 10_000,
        fullScore: 100,
      },
      { actorUserId: ctx.teacherUserId }
    );
    await publishScoreItem(a.scoreItemId!, { actorUserId: ctx.teacherUserId });
    await expect(
      deleteAssignment(a.id, { actorUserId: ctx.teacherUserId })
    ).rejects.toBeInstanceOf(Conflict);
  });
});
