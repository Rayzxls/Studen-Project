// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db/client";
import { Conflict, Forbidden } from "@/lib/errors";
import {
  archiveCourseRewardTier,
  claimHighestEligibleCourseReward,
  createCourseRewardTier,
  getStudentCourseRewardMilestoneDashboard,
  getTeacherCourseRewardMilestoneDashboard,
  resolveCourseRewardClaim,
  updateCourseRewardTier,
} from "@/lib/reward/course-milestones";
import {
  enrollStudent,
  setupTestCourse,
  type TestCourseContext,
} from "./_fixtures";

const ENABLED = {
  COURSE_REWARD_MILESTONES_ENABLED: "1",
  COURSE_REWARD_MILESTONES_MUTATIONS_ENABLED: "1",
} as const;

describe("Course Score Milestone permissions and claim lifecycle", () => {
  let ctx: TestCourseContext;
  let enrollmentId: string;

  beforeEach(async () => {
    ctx = await setupTestCourse();
    const enrollment = await enrollStudent(
      ctx.courseOfferingId,
      ctx.studentUserId
    );
    enrollmentId = enrollment.id;
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  async function createTier(
    requiredScore: number,
    title = `Tier ${requiredScore}`
  ) {
    return createCourseRewardTier({
      courseOfferingId: ctx.courseOfferingId,
      title,
      requiredScore,
      fulfillmentInstructions: "Show this claim to the Teacher",
      ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
    });
  }

  async function setPublishedScore(value: number, fullScore = 100) {
    const item = await db.scoreItem.create({
      data: {
        courseOfferingId: ctx.courseOfferingId,
        name: "Published score for milestone test",
        fullScore,
        publishedAt: new Date("2026-08-17T00:00:00Z"),
      },
      select: { id: true },
    });
    await db.scoreEntry.create({
      data: {
        scoreItemId: item.id,
        enrollmentId,
        value,
        markedById: ctx.teacherUserId,
      },
    });
    return item.id;
  }

  it("fails closed and permits only the owning Teacher to configure tiers", async () => {
    await expect(
      createCourseRewardTier({
        courseOfferingId: ctx.courseOfferingId,
        title: "Closed",
        requiredScore: 50,
        ctx: { actorUserId: ctx.teacherUserId, env: {} },
      })
    ).rejects.toBeInstanceOf(Forbidden);

    await expect(
      createCourseRewardTier({
        courseOfferingId: ctx.courseOfferingId,
        title: "Foreign",
        requiredScore: 50,
        ctx: { actorUserId: ctx.otherTeacherUserId, env: ENABLED },
      })
    ).rejects.toBeInstanceOf(Forbidden);

    const tier = await createTier(50);
    await expect(createTier(50, "Duplicate threshold")).rejects.toBeInstanceOf(
      Conflict
    );
    await expect(
      db.courseRewardTierRevision.count({ where: { tierId: tier.id } })
    ).resolves.toBe(1);
  });

  it("claims only the highest eligible tier and supersedes skipped lower tiers", async () => {
    const tier50 = await createTier(50);
    const tier80 = await createTier(80);
    await createTier(90);
    await setPublishedScore(80);

    const first = await claimHighestEligibleCourseReward({
      enrollmentId,
      ctx: { actorUserId: ctx.studentUserId, env: ENABLED },
    });
    const duplicate = await claimHighestEligibleCourseReward({
      enrollmentId,
      ctx: { actorUserId: ctx.studentUserId, env: ENABLED },
    });

    expect(first).toMatchObject({
      tierId: tier80.id,
      status: "PENDING",
      snapshotTierRequiredScore: 80,
      snapshotScorePercent: 80,
      snapshotEarnedScore: 80,
      snapshotPublishedFullScore: 100,
    });
    expect(duplicate.id).toBe(first.id);
    await expect(
      db.courseRewardClaim.findFirstOrThrow({
        where: { enrollmentId, tierId: tier50.id },
        select: { status: true, supersededByClaimId: true },
      })
    ).resolves.toEqual({
      status: "SUPERSEDED",
      supersededByClaimId: first.id,
    });
    await expect(
      db.courseRewardClaim.count({ where: { enrollmentId, status: "PENDING" } })
    ).resolves.toBe(1);
  });

  it("allows a later higher tier after the lower claim is fulfilled", async () => {
    const tier50 = await createTier(50);
    const tier80 = await createTier(80);
    const scoreItemId = await setPublishedScore(50);

    const lower = await claimHighestEligibleCourseReward({
      enrollmentId,
      ctx: { actorUserId: ctx.studentUserId, env: ENABLED },
    });
    expect(lower.tierId).toBe(tier50.id);
    await expect(
      resolveCourseRewardClaim({
        claimId: lower.id,
        outcome: "FULFILLED",
        ctx: { actorUserId: ctx.otherTeacherUserId, env: ENABLED },
      })
    ).rejects.toBeInstanceOf(Forbidden);

    await expect(
      resolveCourseRewardClaim({
        claimId: lower.id,
        outcome: "FULFILLED",
        ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
      })
    ).resolves.toMatchObject({ status: "FULFILLED" });
    await db.scoreEntry.update({
      where: { scoreItemId_enrollmentId: { scoreItemId, enrollmentId } },
      data: { value: 80 },
    });

    await expect(
      claimHighestEligibleCourseReward({
        enrollmentId,
        ctx: { actorUserId: ctx.studentUserId, env: ENABLED },
      })
    ).resolves.toMatchObject({ tierId: tier80.id, status: "PENDING" });
  });

  it("requires a rejection reason and freezes mutations after removal", async () => {
    await createTier(50);
    await setPublishedScore(70);
    const claim = await claimHighestEligibleCourseReward({
      enrollmentId,
      ctx: { actorUserId: ctx.studentUserId, env: ENABLED },
    });

    await expect(
      resolveCourseRewardClaim({
        claimId: claim.id,
        outcome: "REJECTED",
        reason: "no",
        ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
      })
    ).rejects.toMatchObject({ code: "resolution_reason_too_short" });

    await db.enrollment.update({
      where: { id: enrollmentId },
      data: { removedAt: new Date(), removedById: ctx.teacherUserId },
    });
    await expect(
      resolveCourseRewardClaim({
        claimId: claim.id,
        outcome: "REJECTED",
        reason: "Score was corrected after publication",
        ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
      })
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("projects self/owner dashboards and preserves tier revisions across update/archive", async () => {
    const tier = await createTier(50, "Starter reward");
    await updateCourseRewardTier({
      tierId: tier.id,
      title: "Progress reward",
      description: "Published score milestone",
      fulfillmentInstructions: "Show the pending request to the Teacher",
      requiredScore: 60,
      ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
    });
    await setPublishedScore(70);

    const studentDashboard = await getStudentCourseRewardMilestoneDashboard({
      courseOfferingId: ctx.courseOfferingId,
      ctx: { actorUserId: ctx.studentUserId, env: ENABLED },
    });
    expect(studentDashboard).toMatchObject({
      enrollmentId,
      score: {
        percent: 70,
        earnedScore: 70,
        publishedFullScore: 100,
      },
      claimableTierId: tier.id,
    });
    expect(studentDashboard.tiers).toHaveLength(1);

    const claim = await claimHighestEligibleCourseReward({
      enrollmentId,
      ctx: { actorUserId: ctx.studentUserId, env: ENABLED },
    });
    const teacherDashboard = await getTeacherCourseRewardMilestoneDashboard({
      courseOfferingId: ctx.courseOfferingId,
      ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
    });
    expect(teacherDashboard.pendingClaims).toEqual([
      expect.objectContaining({
        id: claim.id,
        snapshotTierTitle: "Progress reward",
        student: expect.objectContaining({
          userId: ctx.studentUserId,
          firstName: "Alice",
        }),
      }),
    ]);

    await archiveCourseRewardTier({
      tierId: tier.id,
      ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
    });
    await expect(
      db.courseRewardTierRevision.count({ where: { tierId: tier.id } })
    ).resolves.toBe(3);
    await expect(
      getStudentCourseRewardMilestoneDashboard({
        courseOfferingId: ctx.courseOfferingId,
        ctx: { actorUserId: ctx.studentUserId, env: ENABLED },
      })
    ).resolves.toMatchObject({ tiers: [], claimableTierId: null });
  });
});
