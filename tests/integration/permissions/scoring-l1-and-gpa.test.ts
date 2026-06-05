// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { createScoreItem, publishScoreItem } from "@/lib/scoring/score-item";
import { bulkUpsertScoreEntries } from "@/lib/scoring/score-entry";
import {
  getOwnScoresForStudent,
  getStudentTermSnapshot,
} from "@/lib/scoring/queries";
import { termGpa } from "@/lib/scoring/term-gpa";
import { Forbidden, NotFound } from "@/lib/errors";
import {
  enrollStudent,
  setupTestCourse,
  type TestCourseContext,
} from "./_fixtures";

/**
 * Integration tests for the Phase 5 read paths — Pattern 4 (L1 DB-layer
 * projection) and the end-to-end termGpa() pipeline against real Neon.
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
    // type. We additionally sanity-check there is no value === 90 reachable.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("90");
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

describe("getStudentTermSnapshot + termGpa — end-to-end pipeline", () => {
  let ctx: TestCourseContext;

  beforeEach(async () => {
    ctx = await setupTestCourse();
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  it("produces null GPA when no enrollments in term", async () => {
    const snapshot = await getStudentTermSnapshot(
      ctx.studentUserId,
      ctx.termId
    );
    expect(snapshot.rows).toHaveLength(0);
    const gpa = termGpa(snapshot.bundles);
    expect(gpa.value).toBeNull();
    expect(gpa.gradeBearingCourses).toBe(0);
  });

  it("produces null GPA when some published-incomplete, computed when complete", async () => {
    const enrollment = await enrollStudent(
      ctx.courseOfferingId,
      ctx.studentUserId
    );

    const a = await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "Midterm",
        fullScore: 50,
      },
      { actorUserId: ctx.teacherUserId }
    );
    const b = await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "Final",
        fullScore: 50,
      },
      { actorUserId: ctx.teacherUserId }
    );
    // Publish only A and enter a value for it. GPA must stay null because B
    // is still draft.
    await publishScoreItem(a.id, { actorUserId: ctx.teacherUserId });
    await bulkUpsertScoreEntries({
      scoreItemId: a.id,
      items: [{ enrollmentId: enrollment.id, value: 40 }],
      actorUserId: ctx.teacherUserId,
      reason: "first marks after publish",
    });

    let snapshot = await getStudentTermSnapshot(ctx.studentUserId, ctx.termId);
    let gpa = termGpa(snapshot.bundles);
    expect(gpa.value).toBeNull();

    // Now publish B + enter score, GPA should compute.
    // A: 40/50 = 80% × 0.5 = 40
    // B: 35/50 = 70% × 0.5 = 35
    // Total: 75% → grade 3.5
    await publishScoreItem(b.id, { actorUserId: ctx.teacherUserId });
    await bulkUpsertScoreEntries({
      scoreItemId: b.id,
      items: [{ enrollmentId: enrollment.id, value: 35 }],
      actorUserId: ctx.teacherUserId,
      reason: "first marks after publish",
    });

    snapshot = await getStudentTermSnapshot(ctx.studentUserId, ctx.termId);
    gpa = termGpa(snapshot.bundles);
    // Single course, 1 credit hour, grade 3.5 → GPA 3.5
    expect(gpa.value).toBe(3.5);
  });

  it("excludes a removed enrollment from GPA + completion (Q4 lock)", async () => {
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

    const snapshot = await getStudentTermSnapshot(
      ctx.studentUserId,
      ctx.termId
    );
    expect(snapshot.rows).toHaveLength(0);
    const gpa = termGpa(snapshot.bundles);
    expect(gpa.value).toBeNull();
    expect(gpa.gradeBearingCourses).toBe(0);
  });

  it("excludes creditHours=0 course from GPA + completion (Q4 lock)", async () => {
    // Set the test course to creditHours=0 (e.g. ลูกเสือ).
    await db.courseOffering.update({
      where: { id: ctx.courseOfferingId },
      data: { creditHours: 0 },
    });
    const enrollment = await enrollStudent(
      ctx.courseOfferingId,
      ctx.studentUserId
    );
    // Even with an unpublished item, this course shouldn't block completion.
    await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "Conduct",
        fullScore: 10,
      },
      { actorUserId: ctx.teacherUserId }
    );

    const snapshot = await getStudentTermSnapshot(
      ctx.studentUserId,
      ctx.termId
    );
    const gpa = termGpa(snapshot.bundles);
    expect(gpa.value).toBeNull();
    expect(gpa.gradeBearingCourses).toBe(0); // creditHours=0 excluded
    expect(gpa.totalCourses).toBe(1);

    // Suppress unused-var lint (enrollment is set up for shape parity even
    // though we never read it back).
    void enrollment;
  });
});
