// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { createScoreItem, publishScoreItem } from "@/lib/scoring/score-item";
import { bulkUpsertScoreEntries } from "@/lib/scoring/score-entry";
import {
  getOwnScoresForStudent,
  listStudentLearningResults,
} from "@/lib/scoring/queries";
import { Forbidden, NotFound } from "@/lib/errors";
import {
  enrollStudent,
  setupTestCourse,
  type TestCourseContext,
} from "./_fixtures";

/**
 * Integration tests for the Phase 5 read paths: Pattern 4 (L1 DB-layer
 * projection) and the course-oriented Learning Results projection.
 */

describe("getOwnScoresForStudent — L1 projection (Pattern 4)", () => {
  let ctx: TestCourseContext;
  let scoreItemId: string;
  let myEnrollId: string;
  let peerEnrollId: string;

  beforeEach(async () => {
    ctx = await setupTestCourse();
    const item = await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "Final",
        fullScore: 100,
      },
      { actorUserId: ctx.teacherUserId }
    );
    await publishScoreItem(item.id, { actorUserId: ctx.teacherUserId });
    scoreItemId = item.id;
    const my = await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    const peer = await enrollStudent(
      ctx.courseOfferingId,
      ctx.otherStudentUserId
    );
    myEnrollId = my.id;
    peerEnrollId = peer.id;
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  it("returns own value AND ONLY own value (no peer rows on the wire)", async () => {
    await bulkUpsertScoreEntries({
      scoreItemId,
      items: [
        { enrollmentId: myEnrollId, value: 75 },
        { enrollmentId: peerEnrollId, value: 90 },
      ],
      actorUserId: ctx.teacherUserId,
      reason: "first marks after publish",
    });
    const result = await getOwnScoresForStudent(
      ctx.courseOfferingId,
      ctx.studentUserId
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.myValue).toBe(75);
    // The result shape exposes ONLY my values — peer rows are not in the
    // type. Sanity-check the peer's `90` is not present as a numeric value
    // anywhere we'd render it. A bare `.toContain("90")` over the JSON
    // serialisation is brittle: ms-timestamps like ".903Z" + cuids contain
    // the substring "90" by accident. Scope the check to the value-bearing
    // numeric fields so we catch a real L1 leak but not the noise.
    expect(result.items[0]!.myValue).not.toBe(90);
    expect((result as unknown as { peers?: unknown[] }).peers).toBeUndefined();
  });

  it("hides draft items from students entirely", async () => {
    // Add a second item, do NOT publish.
    await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "Draft Quiz",
        fullScore: 10,
      },
      { actorUserId: ctx.teacherUserId }
    );
    const result = await getOwnScoresForStudent(
      ctx.courseOfferingId,
      ctx.studentUserId
    );
    // Only the originally-published item should appear.
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(scoreItemId);
    // But the totals reflect publish progress so the UI can render the
    // "ยังไม่จบเทอม" hint.
    expect(result.totalItems).toBe(2);
    expect(result.publishedItems).toBe(1);
  });

  it("throws NotFound when student has no enrollment in course", async () => {
    await expect(
      getOwnScoresForStudent(ctx.courseOfferingId, ctx.otherTeacherUserId)
    ).rejects.toBeInstanceOf(NotFound);
  });

  it("removed-and-empty enrollment → Forbidden (defensive 403)", async () => {
    // Remove the bystander student who has NO entries.
    await db.enrollment.update({
      where: { id: peerEnrollId },
      data: { removedAt: new Date(), removedById: ctx.teacherUserId },
    });
    await expect(
      getOwnScoresForStudent(ctx.courseOfferingId, ctx.otherStudentUserId)
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("removed-but-historically-graded enrollment → returns own past entries", async () => {
    // Land a peer entry, then remove their enrollment.
    await bulkUpsertScoreEntries({
      scoreItemId,
      items: [{ enrollmentId: peerEnrollId, value: 60 }],
      actorUserId: ctx.teacherUserId,
      reason: "first marks after publish",
    });
    await db.enrollment.update({
      where: { id: peerEnrollId },
      data: { removedAt: new Date(), removedById: ctx.teacherUserId },
    });
    const result = await getOwnScoresForStudent(
      ctx.courseOfferingId,
      ctx.otherStudentUserId
    );
    // History-preserving — past entries still visible to the removed student.
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.myValue).toBe(60);
  });
});

describe("listStudentLearningResults — course-oriented projection", () => {
  let ctx: TestCourseContext;

  beforeEach(async () => {
    ctx = await setupTestCourse();
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  it("returns no rows when the student has no course enrollment", async () => {
    const rows = await listStudentLearningResults(ctx.studentUserId);
    expect(rows).toHaveLength(0);
  });

  it("returns course metadata and only the requesting student's scores", async () => {
    const enrollment = await enrollStudent(
      ctx.courseOfferingId,
      ctx.studentUserId
    );
    const peerEnrollment = await enrollStudent(
      ctx.courseOfferingId,
      ctx.otherStudentUserId
    );
    await db.courseOffering.update({
      where: { id: ctx.courseOfferingId },
      data: {
        subjectCode: "SCI101",
        learnerGroupLabel: "ม.4/3",
        academicPeriodLabel: "ภาคเรียน 1/2569",
        creditHours: 2,
      },
    });
    const item = await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "Project",
        fullScore: 100,
      },
      { actorUserId: ctx.teacherUserId }
    );
    await publishScoreItem(item.id, { actorUserId: ctx.teacherUserId });
    await bulkUpsertScoreEntries({
      scoreItemId: item.id,
      items: [
        { enrollmentId: enrollment.id, value: 80 },
        { enrollmentId: peerEnrollment.id, value: 95 },
      ],
      actorUserId: ctx.teacherUserId,
      reason: "first marks after publish",
    });

    const rows = await listStudentLearningResults(ctx.studentUserId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      courseOfferingId: ctx.courseOfferingId,
      subjectCode: "SCI101",
      learnerGroupLabel: "ม.4/3",
      academicPeriodLabel: "ภาคเรียน 1/2569",
      creditHours: 2,
      enrollmentRemovedAt: null,
    });
    expect(rows[0]!.entries).toEqual([{ scoreItemId: item.id, value: 80 }]);
  });

  it("keeps a removed enrollment in history when it has a score", async () => {
    const enrollment = await enrollStudent(
      ctx.courseOfferingId,
      ctx.studentUserId
    );
    const item = await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "Only",
        fullScore: 10,
      },
      { actorUserId: ctx.teacherUserId }
    );
    await publishScoreItem(item.id, { actorUserId: ctx.teacherUserId });
    await bulkUpsertScoreEntries({
      scoreItemId: item.id,
      items: [{ enrollmentId: enrollment.id, value: 9 }],
      actorUserId: ctx.teacherUserId,
      reason: "first mark",
    });

    // Now remove the enrollment.
    await db.enrollment.update({
      where: { id: enrollment.id },
      data: { removedAt: new Date(), removedById: ctx.teacherUserId },
    });

    const rows = await listStudentLearningResults(ctx.studentUserId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.enrollmentRemovedAt).toBeInstanceOf(Date);
    expect(rows[0]!.entries).toEqual([{ scoreItemId: item.id, value: 9 }]);
  });

  it("omits a removed enrollment that has no score history", async () => {
    const enrollment = await enrollStudent(
      ctx.courseOfferingId,
      ctx.studentUserId
    );
    await db.enrollment.update({
      where: { id: enrollment.id },
      data: { removedAt: new Date(), removedById: ctx.teacherUserId },
    });

    const rows = await listStudentLearningResults(ctx.studentUserId);
    expect(rows).toHaveLength(0);
  });
});
