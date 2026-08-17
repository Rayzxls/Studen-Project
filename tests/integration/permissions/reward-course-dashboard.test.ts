// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db/client";
import { NotFound } from "@/lib/errors";
import { awardCourseRewardPoints } from "@/lib/reward/course-ledger";
import {
  getStudentCourseRewardDashboard,
  getTeacherCourseRewardDashboard,
} from "@/lib/reward/course-dashboard";
import {
  enrollStudent,
  setupTestCourse,
  type TestCourseContext,
} from "./_fixtures";

const ENABLED = {
  REWARD_ENABLED: "1",
  REWARD_MUTATIONS_ENABLED: "1",
} as const;

describe("course reward dashboard projections", () => {
  let ctx: TestCourseContext;
  let enrollmentId: string;
  let assignmentId: string;

  beforeEach(async () => {
    ctx = await setupTestCourse();
    const enrollment = await enrollStudent(
      ctx.courseOfferingId,
      ctx.studentUserId
    );
    enrollmentId = enrollment.id;

    const assignment = await db.assignment.create({
      data: {
        courseOfferingId: ctx.courseOfferingId,
        title: "ส่งแผนผังความคิด",
        description: "สรุปบทเรียนเป็นแผนผัง",
        createdById: ctx.teacherUserId,
      },
      select: { id: true },
    });
    assignmentId = assignment.id;
    await db.submission.create({
      data: {
        assignmentId,
        enrollmentId,
        status: "SUBMITTED",
      },
    });

    const session = await db.session.create({
      data: {
        courseOfferingId: ctx.courseOfferingId,
        scheduledStart: new Date("2026-08-17T01:30:00.000Z"),
        scheduledEnd: new Date("2026-08-17T02:30:00.000Z"),
        createdById: ctx.teacherUserId,
      },
      select: { id: true },
    });
    await db.attendanceRecord.create({
      data: {
        sessionId: session.id,
        enrollmentId,
        status: "PRESENT",
        markedById: ctx.teacherUserId,
      },
    });

    const scoreItem = await db.scoreItem.create({
      data: {
        courseOfferingId: ctx.courseOfferingId,
        name: "แบบฝึกท้ายบท",
        fullScore: 10,
        publishedAt: new Date(),
      },
      select: { id: true },
    });
    await db.scoreEntry.create({
      data: {
        scoreItemId: scoreItem.id,
        enrollmentId,
        value: 8,
        markedById: ctx.teacherUserId,
      },
    });
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("builds only evidence-backed award candidates for the owning teacher", async () => {
    const dashboard = await getTeacherCourseRewardDashboard({
      courseOfferingId: ctx.courseOfferingId,
      ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
    });

    expect(dashboard.members).toHaveLength(1);
    expect(dashboard.members[0]?.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          achievementType: "ASSIGNMENT_SUBMITTED",
          achievementId: assignmentId,
          awarded: false,
        }),
        expect.objectContaining({ achievementType: "ATTENDANCE_PRESENT" }),
        expect.objectContaining({ achievementType: "SCORE_THRESHOLD" }),
      ])
    );
    expect(dashboard.members[0]?.candidates).toHaveLength(3);
  });

  it("marks paid evidence and computes balances from the whole ledger", async () => {
    await awardCourseRewardPoints({
      enrollmentId,
      points: 12,
      achievementType: "ASSIGNMENT_SUBMITTED",
      achievementId: assignmentId,
      reason: "ส่งงานครบและอธิบายชัดเจน",
      ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
    });

    const [teacher, student] = await Promise.all([
      getTeacherCourseRewardDashboard({
        courseOfferingId: ctx.courseOfferingId,
        ctx: { actorUserId: ctx.teacherUserId, env: ENABLED },
      }),
      getStudentCourseRewardDashboard({
        courseOfferingId: ctx.courseOfferingId,
        ctx: { actorUserId: ctx.studentUserId, env: ENABLED },
      }),
    ]);

    expect(teacher).toMatchObject({ totalBalance: 12, membersWithPoints: 1 });
    expect(
      teacher.members[0]?.candidates.find(
        (candidate) => candidate.achievementId === assignmentId
      )
    ).toMatchObject({ awarded: true });
    expect(student).toMatchObject({
      enrollmentId,
      balance: 12,
      entries: [
        expect.objectContaining({
          amount: 12,
          achievementType: "ASSIGNMENT_SUBMITTED",
        }),
      ],
    });
  });

  it("denies foreign teachers and students outside the course", async () => {
    await expect(
      getTeacherCourseRewardDashboard({
        courseOfferingId: ctx.courseOfferingId,
        ctx: { actorUserId: ctx.otherTeacherUserId, env: ENABLED },
      })
    ).rejects.toBeInstanceOf(NotFound);
    await expect(
      getStudentCourseRewardDashboard({
        courseOfferingId: ctx.courseOfferingId,
        ctx: { actorUserId: ctx.otherStudentUserId, env: ENABLED },
      })
    ).rejects.toBeInstanceOf(NotFound);
  });
});
