// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db/client";
import { Conflict, Forbidden, NotFound } from "@/lib/errors";
import {
  awardCourseRewardPoints,
  getCourseRewardSnapshot,
  reverseCourseRewardEntry,
} from "@/lib/reward/course-ledger";
import {
  enrollStudent,
  setupTestCourse,
  type TestCourseContext,
} from "./_fixtures";

const ENABLED = {
  REWARD_ENABLED: "1",
  REWARD_MUTATIONS_ENABLED: "1",
} as const;

describe("course reward ledger permissions and lifecycle", () => {
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

  it("fails closed before touching reward data when feature gates are off", async () => {
    await expect(
      getCourseRewardSnapshot({
        enrollmentId,
        ctx: { actorUserId: ctx.studentUserId, env: {} },
      })
    ).rejects.toBeInstanceOf(NotFound);

    await expect(
      awardCourseRewardPoints({
        enrollmentId,
        points: 10,
        achievementType: "ATTENDANCE_PRESENT",
        achievementId: "attendance-1",
        ctx: {
          actorUserId: ctx.teacherUserId,
          env: { REWARD_ENABLED: "1", REWARD_MUTATIONS_ENABLED: "0" },
        },
      })
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("awards once per achievement and lets the enrolled student read the balance", async () => {
    const input = {
      enrollmentId,
      points: 25,
      achievementType: "ASSIGNMENT_SUBMITTED" as const,
      achievementId: "submission-42",
      reason: "Submitted the assignment",
      ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
    };
    const first = await awardCourseRewardPoints(input);
    const duplicate = await awardCourseRewardPoints(input);

    expect(duplicate.id).toBe(first.id);
    const snapshot = await getCourseRewardSnapshot({
      enrollmentId,
      ctx: { actorUserId: ctx.studentUserId, env: ENABLED },
    });
    expect(snapshot).toMatchObject({ balance: 25, frozen: false });
    expect(snapshot.entries).toHaveLength(1);
    expect(
      await db.auditLog.count({
        where: {
          actorId: ctx.teacherUserId,
          action: "REWARD_POINTS_AWARDED",
          targetId: first.id,
        },
      })
    ).toBe(1);
  });

  it("denies unrelated teachers and students", async () => {
    for (const actorUserId of [
      ctx.otherTeacherUserId,
      ctx.otherStudentUserId,
    ]) {
      await expect(
        getCourseRewardSnapshot({
          enrollmentId,
          ctx: { actorUserId, env: ENABLED },
        })
      ).rejects.toBeInstanceOf(Forbidden);
    }

    await expect(
      awardCourseRewardPoints({
        enrollmentId,
        points: 10,
        achievementType: "SCORE_THRESHOLD",
        achievementId: "score-item-1",
        ctx: { actorUserId: ctx.otherTeacherUserId, env: ENABLED },
      })
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("keeps archived course history readable but frozen until restored", async () => {
    const awarded = await awardCourseRewardPoints({
      enrollmentId,
      points: 10,
      achievementType: "ATTENDANCE_PRESENT",
      achievementId: "session-1",
      ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
    });
    await db.courseOffering.update({
      where: { id: ctx.courseOfferingId },
      data: { archivedAt: new Date() },
    });

    const frozen = await getCourseRewardSnapshot({
      enrollmentId,
      ctx: { actorUserId: ctx.studentUserId, env: ENABLED },
    });
    expect(frozen).toMatchObject({ balance: 10, frozen: true });
    await expect(
      reverseCourseRewardEntry({
        entryId: awarded.id,
        reason: "Correcting an archived course",
        ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
      })
    ).rejects.toBeInstanceOf(Forbidden);

    await db.courseOffering.update({
      where: { id: ctx.courseOfferingId },
      data: { archivedAt: null },
    });
    await expect(
      reverseCourseRewardEntry({
        entryId: awarded.id,
        reason: "Correcting restored course points",
        ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
      })
    ).resolves.toMatchObject({ amount: -10, reversesEntryId: awarded.id });
  });

  it("keeps removed enrollment history readable but blocks mutations", async () => {
    await awardCourseRewardPoints({
      enrollmentId,
      points: 15,
      achievementType: "SYSTEM_QUEST",
      achievementId: "course-quest-1",
      ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
    });
    await db.enrollment.update({
      where: { id: enrollmentId },
      data: { removedAt: new Date(), removedById: ctx.teacherUserId },
    });

    await expect(
      getCourseRewardSnapshot({
        enrollmentId,
        ctx: { actorUserId: ctx.studentUserId, env: ENABLED },
      })
    ).resolves.toMatchObject({ balance: 15, frozen: true });
    await expect(
      awardCourseRewardPoints({
        enrollmentId,
        points: 5,
        achievementType: "ATTENDANCE_PRESENT",
        achievementId: "session-after-removal",
        ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
      })
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("reverses by appending an audited balancing entry and never mutates the award", async () => {
    const awarded = await awardCourseRewardPoints({
      enrollmentId,
      points: 30,
      achievementType: "SCORE_THRESHOLD",
      achievementId: "score-item-9",
      ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
    });
    const reversed = await reverseCourseRewardEntry({
      entryId: awarded.id,
      reason: "Score was entered incorrectly",
      ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
    });

    expect(reversed).toMatchObject({
      kind: "REVERSAL",
      amount: -30,
      reversesEntryId: awarded.id,
    });
    const original = await db.rewardLedgerEntry.findUniqueOrThrow({
      where: { id: awarded.id },
      select: { kind: true, amount: true, reason: true },
    });
    expect(original).toMatchObject({ kind: "AWARD", amount: 30 });
    await expect(
      getCourseRewardSnapshot({
        enrollmentId,
        ctx: { actorUserId: ctx.studentUserId, env: ENABLED },
      })
    ).resolves.toMatchObject({ balance: 0 });
    expect(
      await db.auditLog.count({
        where: {
          actorId: ctx.teacherUserId,
          action: "REWARD_ENTRY_REVERSED",
          targetId: reversed.id,
        },
      })
    ).toBe(1);
    await expect(
      reverseCourseRewardEntry({
        entryId: awarded.id,
        reason: "Trying the same correction twice",
        ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
      })
    ).rejects.toBeInstanceOf(Conflict);
  });
});
