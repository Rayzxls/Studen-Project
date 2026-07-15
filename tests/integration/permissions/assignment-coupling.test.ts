/**
 * Integration — Assignment ↔ ScoreItem coupling (Phase 6 · ADR-0019
 * post-ADR-0024 update: weight channel removed, fullScore alone)
 *
 * Exercises the synchronous atomic coupling + the toggle 3-state matrix
 * against the real Neon dev DB:
 *   - createAssignment(isScored=true) → ScoreItem materialised in same tx
 *   - flip false→true → coupling at flip-time (fullScore required)
 *   - flip true→false → draft+0 atomic delete · draft+N block · published block
 *   - non-toggle field edits — class A passes, fullScore rejected
 *     (it routes through lib/scoring.updateScoreItem with ADR-0018 reason gate)
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
  it("snapshots the linked Lesson id in ASSIGNMENT_POSTED", async () => {
    await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    const lesson = await db.lesson.create({
      data: {
        courseOfferingId: ctx.courseOfferingId,
        title: "บททดสอบ Notification",
        position: 0,
        createdById: ctx.teacherUserId,
      },
    });
    const assignment = await createAssignment(
      {
        courseOfferingId: ctx.courseOfferingId,
        lessonId: lesson.id,
        title: "Lesson-linked assignment",
        description: "",
        allowText: true,
        allowFile: false,
        allowLink: false,
        isScored: false,
      },
      { actorUserId: ctx.teacherUserId }
    );

    const row = await db.notification.findFirstOrThrow({
      where: {
        recipientId: ctx.studentUserId,
        sourceEntityType: "ASSIGNMENT",
        sourceEntityId: assignment.id,
      },
      select: { payloadJson: true },
    });
    expect((row.payloadJson as Record<string, unknown>).lessonId).toBe(
      lesson.id
    );
  });

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
        fullScore: 20,
      },
      { actorUserId: ctx.teacherUserId }
    );
    expect(a.scoreItemId).not.toBeNull();
    const si = await db.scoreItem.findUnique({
      where: { id: a.scoreItemId! },
      select: { source: true, fullScore: true, name: true },
    });
    expect(si).toEqual({
      source: "ASSIGNMENT_LINKED",
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
      { isScored: true, fullScore: 50 },
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

  it("non-toggle update rejects fullScore in patch (route through lib/scoring per ADR-0024)", async () => {
    const a = await createAssignment(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: "X",
        description: "",
        allowText: true,
        allowFile: false,
        allowLink: false,
        isScored: true,
        fullScore: 50,
      },
      { actorUserId: ctx.teacherUserId }
    );
    await expect(
      updateAssignment(
        a.id,
        { fullScore: 60 },
        { actorUserId: ctx.teacherUserId }
      )
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("flip on requires fullScore — missing fullScore throws ValidationError", async () => {
    const a = await createAssignment(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: "Missing fullScore",
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
        { isScored: true },
        { actorUserId: ctx.teacherUserId }
      )
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("flip on creates ScoreItem with source=ASSIGNMENT_LINKED + fullScore", async () => {
    const a = await createAssignment(
      {
        courseOfferingId: ctx.courseOfferingId,
        title: "Flip success",
        description: "",
        allowText: true,
        allowFile: false,
        allowLink: false,
        isScored: false,
      },
      { actorUserId: ctx.teacherUserId }
    );
    const flipped = await updateAssignment(
      a.id,
      { isScored: true, fullScore: 30 },
      { actorUserId: ctx.teacherUserId }
    );
    const si = await db.scoreItem.findUnique({
      where: { id: flipped.scoreItemId! },
      select: { source: true, fullScore: true },
    });
    expect(si).toEqual({ source: "ASSIGNMENT_LINKED", fullScore: 30 });
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
