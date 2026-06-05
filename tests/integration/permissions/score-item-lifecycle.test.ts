// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import {
  createScoreItem,
  deleteScoreItem,
  publishScoreItem,
  updateScoreItem,
} from "@/lib/scoring/score-item";
import { bulkUpsertScoreEntries } from "@/lib/scoring/score-entry";
import { Conflict, Forbidden, ValidationError } from "@/lib/errors";
import {
  enrollStudent,
  setupTestCourse,
  type TestCourseContext,
} from "./_fixtures";

/**
 * Integration tests for lib/scoring/score-item.ts — Phase 5 + Phase 10
 * cutover (ADR-0024 supersedes ADR-0017 weight invariant).
 *
 * Verifies ADR-0018 (publish one-way + field-class A/C edit policy,
 * narrowed-B {fullScore}-only after ADR-0024) and ADR-0024 (sum-based:
 * publish has no Σ precondition; fullScore alone encodes per-item
 * influence) against live Neon.
 *
 * Pattern 2 (authz inside the $transaction) is exercised explicitly by
 * cross-teacher Forbidden tests for every mutation; Pattern 3 (TX_OPTS)
 * is covered implicitly — these tests would time out on cold Neon
 * without the 10s/15s extension.
 */

const ctx0 = (ctx: TestCourseContext) => ({
  actorUserId: ctx.teacherUserId,
});

describe("createScoreItem", () => {
  let ctx: TestCourseContext;
  beforeEach(async () => {
    ctx = await setupTestCourse();
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  it("creates a draft ScoreItem (publishedAt = null)", async () => {
    const item = await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "สอบกลางภาค",
        fullScore: 30,
      },
      ctx0(ctx)
    );
    expect(item.publishedAt).toBeNull();
    expect(item.fullScore).toBe(30);
    expect(item.source).toBe("MANUAL");
  });

  it("rejects a non-owning teacher with Forbidden", async () => {
    await expect(
      createScoreItem(
        {
          courseOfferingId: ctx.courseOfferingId,
          name: "X",
          fullScore: 10,
        },
        { actorUserId: ctx.otherTeacherUserId }
      )
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("rejects fullScore <= 0 with ValidationError", async () => {
    await expect(
      createScoreItem(
        {
          courseOfferingId: ctx.courseOfferingId,
          name: "X",
          fullScore: 0,
        },
        ctx0(ctx)
      )
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects non-integer fullScore with ValidationError", async () => {
    await expect(
      createScoreItem(
        {
          courseOfferingId: ctx.courseOfferingId,
          name: "X",
          fullScore: 10.5,
        },
        ctx0(ctx)
      )
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects empty name", async () => {
    await expect(
      createScoreItem(
        {
          courseOfferingId: ctx.courseOfferingId,
          name: "   ",
          fullScore: 10,
        },
        ctx0(ctx)
      )
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("publishScoreItem (ADR-0024 — no Σ precondition)", () => {
  let ctx: TestCourseContext;
  beforeEach(async () => {
    ctx = await setupTestCourse();
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  it("publishes a single ScoreItem (no aggregate gate exists)", async () => {
    const a = await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "A",
        fullScore: 10,
      },
      ctx0(ctx)
    );
    const published = await publishScoreItem(a.id, ctx0(ctx));
    expect(published.publishedAt).not.toBeNull();
  });

  it("publishes even when sibling items are still in draft", async () => {
    // Under ADR-0017 this would have required Σweight === 10000 across
    // ALL items in the course. ADR-0024 removed that gate — a teacher can
    // publish the midterm item while quizzes are still being scaffolded.
    const midterm = await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "Midterm",
        fullScore: 50,
      },
      ctx0(ctx)
    );
    await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "Quiz draft 1",
        fullScore: 10,
      },
      ctx0(ctx)
    );
    await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "Quiz draft 2",
        fullScore: 10,
      },
      ctx0(ctx)
    );
    const published = await publishScoreItem(midterm.id, ctx0(ctx));
    expect(published.publishedAt).not.toBeNull();
  });

  it("emits SCORE_ITEM_PUBLISHED audit on success", async () => {
    const a = await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "Solo",
        fullScore: 10,
      },
      ctx0(ctx)
    );
    await publishScoreItem(a.id, ctx0(ctx));
    const audits = await db.auditLog.findMany({
      where: { action: "SCORE_ITEM_PUBLISHED", targetId: a.id },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.actorId).toBe(ctx.teacherUserId);
  });

  it("audit payload omits the legacy `weight` field (ADR-0024)", async () => {
    const a = await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "Solo",
        fullScore: 10,
      },
      ctx0(ctx)
    );
    await publishScoreItem(a.id, ctx0(ctx));
    const audit = await db.auditLog.findFirst({
      where: { action: "SCORE_ITEM_PUBLISHED", targetId: a.id },
    });
    expect(audit).not.toBeNull();
    // `after` payload should contain fullScore + name + publishedAt only
    const after = audit!.after as Record<string, unknown>;
    expect(after).toHaveProperty("fullScore");
    expect(after).toHaveProperty("publishedAt");
    expect(after).not.toHaveProperty("weight");
  });

  it("rejects re-publish with Conflict (ADR-0018 one-way)", async () => {
    const a = await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "Solo",
        fullScore: 10,
      },
      ctx0(ctx)
    );
    await publishScoreItem(a.id, ctx0(ctx));
    await expect(publishScoreItem(a.id, ctx0(ctx))).rejects.toBeInstanceOf(
      Conflict
    );
  });

  it("rejects cross-teacher publish with Forbidden", async () => {
    const a = await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "Solo",
        fullScore: 10,
      },
      ctx0(ctx)
    );
    await expect(
      publishScoreItem(a.id, { actorUserId: ctx.otherTeacherUserId })
    ).rejects.toBeInstanceOf(Forbidden);
  });
});

describe("updateScoreItem (ADR-0018 field-class dispatch · B={fullScore})", () => {
  let ctx: TestCourseContext;
  beforeEach(async () => {
    ctx = await setupTestCourse();
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  // Helper: publish a single ScoreItem so isPublished branches fire.
  async function makePublished() {
    const item = await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "Quiz",
        fullScore: 20,
      },
      ctx0(ctx)
    );
    return publishScoreItem(item.id, ctx0(ctx));
  }

  it("pre-publish: free edit of any field, no reason required", async () => {
    const item = await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "Quiz",
        fullScore: 20,
      },
      ctx0(ctx)
    );
    const updated = await updateScoreItem(
      item.id,
      { name: "Quiz v2", fullScore: 25 },
      ctx0(ctx)
    );
    expect(updated.name).toBe("Quiz v2");
    expect(updated.fullScore).toBe(25);
  });

  it("post-publish class A (name): free, no reason, no audit", async () => {
    const item = await makePublished();
    const updated = await updateScoreItem(
      item.id,
      { name: "Renamed" },
      ctx0(ctx)
    );
    expect(updated.name).toBe("Renamed");
    const audits = await db.auditLog.findMany({
      where: { action: "SCORE_EDIT_AFTER_PUBLISH", targetId: item.id },
    });
    expect(audits).toHaveLength(0);
  });

  it("post-publish class B (fullScore): rejects without reason", async () => {
    const item = await makePublished();
    await expect(
      updateScoreItem(item.id, { fullScore: 25 }, ctx0(ctx))
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("post-publish class B (fullScore): rejects when reason shorter than 5", async () => {
    const item = await makePublished();
    await expect(
      updateScoreItem(
        item.id,
        { fullScore: 25 },
        { ...ctx0(ctx), reason: "fix" }
      )
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("post-publish class B (fullScore): allows + audits with reason ≥ 5", async () => {
    const item = await makePublished();
    const updated = await updateScoreItem(
      item.id,
      { fullScore: 25 },
      { ...ctx0(ctx), reason: "expanded rubric to add bonus part" }
    );
    expect(updated.fullScore).toBe(25);
    const audits = await db.auditLog.findMany({
      where: { action: "SCORE_EDIT_AFTER_PUBLISH", targetId: item.id },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.reason).toContain("expanded rubric");
    // ADR-0024 — audit before/after only carries fullScore for class B
    // (weight no longer in schema).
    const before = audits[0]!.before as Record<string, unknown>;
    const after = audits[0]!.after as Record<string, unknown>;
    expect(before).toHaveProperty("fullScore", 20);
    expect(after).toHaveProperty("fullScore", 25);
    expect(before).not.toHaveProperty("weight");
    expect(after).not.toHaveProperty("weight");
  });

  it("post-publish fullScore shrink: rejects when an entry exceeds the new cap", async () => {
    const item = await makePublished(); // fullScore = 20
    const e = await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await bulkUpsertScoreEntries({
      scoreItemId: item.id,
      items: [{ enrollmentId: e.id, value: 18 }],
      actorUserId: ctx.teacherUserId,
      reason: "first entry after publish",
    });
    await expect(
      updateScoreItem(
        item.id,
        { fullScore: 15 },
        { ...ctx0(ctx), reason: "shrinking fullScore" }
      )
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("post-publish fullScore shrink: allows when all entries fit", async () => {
    const item = await makePublished(); // fullScore = 20
    const e = await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await bulkUpsertScoreEntries({
      scoreItemId: item.id,
      items: [{ enrollmentId: e.id, value: 10 }],
      actorUserId: ctx.teacherUserId,
      reason: "first entry after publish",
    });
    const updated = await updateScoreItem(
      item.id,
      { fullScore: 12 },
      { ...ctx0(ctx), reason: "lowering ceiling to match rubric" }
    );
    expect(updated.fullScore).toBe(12);
  });

  it("post-publish class C (source): blocks regardless of reason", async () => {
    const item = await makePublished();
    await expect(
      updateScoreItem(
        item.id,
        { source: "ASSIGNMENT_LINKED" },
        { ...ctx0(ctx), reason: "trying to convert anyway" }
      )
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("rejects cross-teacher update with Forbidden", async () => {
    const item = await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "X",
        fullScore: 10,
      },
      ctx0(ctx)
    );
    await expect(
      updateScoreItem(
        item.id,
        { name: "Hijack" },
        { actorUserId: ctx.otherTeacherUserId }
      )
    ).rejects.toBeInstanceOf(Forbidden);
  });
});

describe("deleteScoreItem (ADR-0018 § Decision 1 escape hatch)", () => {
  let ctx: TestCourseContext;
  beforeEach(async () => {
    ctx = await setupTestCourse();
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  it("pre-publish: free delete, no reason, no audit", async () => {
    const item = await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "Drafty",
        fullScore: 10,
      },
      ctx0(ctx)
    );
    await deleteScoreItem(item.id, ctx0(ctx));
    const found = await db.scoreItem.findUnique({ where: { id: item.id } });
    expect(found).toBeNull();
    const audits = await db.auditLog.findMany({
      where: { action: "SCORE_DELETE_AFTER_PUBLISH", targetId: item.id },
    });
    expect(audits).toHaveLength(0);
  });

  it("post-publish: requires reason ≥ 5", async () => {
    const item = await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "Final",
        fullScore: 50,
      },
      ctx0(ctx)
    );
    await publishScoreItem(item.id, ctx0(ctx));
    await expect(deleteScoreItem(item.id, ctx0(ctx))).rejects.toBeInstanceOf(
      ValidationError
    );
    await expect(
      deleteScoreItem(item.id, { ...ctx0(ctx), reason: "ok!" })
    ).rejects.toBeInstanceOf(ValidationError); // length < 5
  });

  it("post-publish: emits SCORE_DELETE_AFTER_PUBLISH + cascades entries", async () => {
    const item = await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "Final",
        fullScore: 50,
      },
      ctx0(ctx)
    );
    await publishScoreItem(item.id, ctx0(ctx));
    const e = await enrollStudent(ctx.courseOfferingId, ctx.studentUserId);
    await bulkUpsertScoreEntries({
      scoreItemId: item.id,
      items: [{ enrollmentId: e.id, value: 40 }],
      actorUserId: ctx.teacherUserId,
      reason: "first entry after publish",
    });
    await deleteScoreItem(item.id, {
      ...ctx0(ctx),
      reason: "moved to next term per dept memo",
    });
    const found = await db.scoreItem.findUnique({ where: { id: item.id } });
    expect(found).toBeNull();
    const stragglerEntries = await db.scoreEntry.findMany({
      where: { scoreItemId: item.id },
    });
    expect(stragglerEntries).toHaveLength(0);
    const audits = await db.auditLog.findMany({
      where: { action: "SCORE_DELETE_AFTER_PUBLISH", targetId: item.id },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.reason).toContain("moved to next term");
    // ADR-0024 — audit before-payload no longer carries weight
    const before = audits[0]!.before as Record<string, unknown>;
    expect(before).toHaveProperty("fullScore", 50);
    expect(before).not.toHaveProperty("weight");
  });

  it("rejects cross-teacher delete with Forbidden", async () => {
    const item = await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "X",
        fullScore: 10,
      },
      ctx0(ctx)
    );
    await expect(
      deleteScoreItem(item.id, { actorUserId: ctx.otherTeacherUserId })
    ).rejects.toBeInstanceOf(Forbidden);
  });
});
