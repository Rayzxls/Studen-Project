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
 * Integration tests for lib/scoring/score-item.ts — Phase 5 P5-7.
 *
 * Verifies ADR-0017 (basis-point weight + publish-gate) and ADR-0018
 * (publish one-way + field-class edit policy) against live Neon.
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

  it("rejects weight outside 0..10000 with ValidationError", async () => {
    await expect(
      createScoreItem(
        {
          courseOfferingId: ctx.courseOfferingId,
          name: "X",
          fullScore: 10,
        },
        ctx0(ctx)
      )
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects fullScore <= 0", async () => {
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

describe("publishScoreItem (ADR-0017 § Decision 2 — Σ === 10000 gate)", () => {
  let ctx: TestCourseContext;
  beforeEach(async () => {
    ctx = await setupTestCourse();
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  it("publishes when Σ weight === 10000", async () => {
    const a = await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "A",
        fullScore: 10,
      },
      ctx0(ctx)
    );
    await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "B",
        fullScore: 10,
      },
      ctx0(ctx)
    );
    const published = await publishScoreItem(a.id, ctx0(ctx));
    expect(published.publishedAt).not.toBeNull();
  });

  it("rejects when Σ weight === 9999 (rounding 33.33% × 3)", async () => {
    const items = [];
    for (let i = 0; i < 3; i++) {
      items.push(
        await createScoreItem(
          {
            courseOfferingId: ctx.courseOfferingId,
            name: `Item${i}`,
            fullScore: 10,
          },
          ctx0(ctx)
        )
      );
    }
    await expect(publishScoreItem(items[0]!.id, ctx0(ctx))).rejects.toThrow(
      ValidationError
    );
  });

  it("rejects when Σ weight === 10001", async () => {
    const a = await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "A",
        fullScore: 10,
      },
      ctx0(ctx)
    );
    await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "B",
        fullScore: 10,
      },
      ctx0(ctx)
    );
    await expect(publishScoreItem(a.id, ctx0(ctx))).rejects.toThrow(
      ValidationError
    );
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

describe("updateScoreItem (ADR-0018 § Decision 2 — field-class dispatch)", () => {
  let ctx: TestCourseContext;
  beforeEach(async () => {
    ctx = await setupTestCourse();
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  // Helper: publish a single 100%-weight item so isPublished branches fire.
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

  it("post-publish class B (weight): rejects without reason", async () => {
    const item = await makePublished();
    await expect(
      updateScoreItem(item.id, {}, ctx0(ctx))
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("post-publish class B (weight): rejects when Σ would break invariant", async () => {
    const item = await makePublished();
    await expect(
      updateScoreItem(item.id, {}, { ...ctx0(ctx), reason: "fixing weight" })
    ).rejects.toBeInstanceOf(ValidationError); // Σ = 9000 ≠ 10000
  });

  it("post-publish class B (weight): allows + audits when Σ stays valid", async () => {
    // Two items: A=4000 published, B=6000 draft. Change A's weight to 3000
    // and B's to 7000 in sequence; both edits must preserve Σ = 10000.
    const a = await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "A",
        fullScore: 10,
      },
      ctx0(ctx)
    );
    const b = await createScoreItem(
      {
        courseOfferingId: ctx.courseOfferingId,
        name: "B",
        fullScore: 10,
      },
      ctx0(ctx)
    );
    await publishScoreItem(a.id, ctx0(ctx));
    // Move 1000 bp from A to B — both should stay valid mid-flight via
    // the two-step. First update B (draft, free) to 7000, then A
    // (published, reason) to 3000. Σ stays 10000 at every step.
    await updateScoreItem(b.id, {}, ctx0(ctx));
    const updated = await updateScoreItem(
      a.id,
      {},
      { ...ctx0(ctx), reason: "rebalance after team review" }
    );
    // ADR-0024: weight removed — assertion no longer applies.
    expect(updated).toBeDefined();
    const audits = await db.auditLog.findMany({
      where: { action: "SCORE_EDIT_AFTER_PUBLISH", targetId: a.id },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.reason).toBe("rebalance after team review");
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
