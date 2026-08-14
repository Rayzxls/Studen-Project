import {
  Prisma,
  type RewardAchievementType,
  type RewardLedgerEntryKind,
} from "@prisma/client";

import { audit } from "@/lib/audit/log";
import { db } from "@/lib/db/client";
import { Conflict, Forbidden, NotFound, ValidationError } from "@/lib/errors";
import {
  rewardEnabled,
  rewardMutationsEnabled,
  type RewardFeatureFlagEnv,
} from "@/lib/reward/feature-flags";
import {
  courseRewardAwardKey,
  courseRewardFrozen,
  normalizeRewardAchievementId,
  normalizeRewardPoints,
  normalizeRewardReason,
} from "@/lib/reward/policy";

const TX_OPTIONS = {
  maxWait: 10_000,
  timeout: 15_000,
  isolationLevel: "Serializable" as const,
};
const DEFAULT_LEDGER_LIMIT = 100;

export type RewardRequestContext = {
  actorUserId: string;
  env?: RewardFeatureFlagEnv;
};

export type RewardLedgerEntryView = {
  id: string;
  kind: RewardLedgerEntryKind;
  amount: number;
  achievementType: RewardAchievementType;
  achievementId: string;
  reversesEntryId: string | null;
  reason: string | null;
  createdAt: Date;
};

export type CourseRewardSnapshot = {
  enrollmentId: string;
  courseOfferingId: string;
  balance: number;
  frozen: boolean;
  entries: RewardLedgerEntryView[];
};

type CourseRewardScope = {
  enrollmentId: string;
  studentId: string;
  enrollmentRemovedAt: Date | null;
  courseOfferingId: string;
  courseName: string;
  courseTeacherId: string;
  courseArchivedAt: Date | null;
};

function validationFromPolicy(error: unknown): never {
  const code = error instanceof Error ? error.message : "reward_invalid";
  throw new ValidationError({ reward: code }, code);
}

function entryView(entry: {
  id: string;
  kind: RewardLedgerEntryKind;
  amount: number;
  achievementType: RewardAchievementType;
  achievementId: string;
  reversesEntryId: string | null;
  reason: string | null;
  createdAt: Date;
}): RewardLedgerEntryView {
  return { ...entry };
}

async function loadCourseRewardScope(
  tx: Prisma.TransactionClient,
  enrollmentId: string
): Promise<CourseRewardScope> {
  const enrollment = await tx.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      studentId: true,
      removedAt: true,
      course: {
        select: {
          id: true,
          name: true,
          teacherId: true,
          archivedAt: true,
        },
      },
    },
  });
  if (!enrollment) throw new NotFound("reward_enrollment_not_found");
  return {
    enrollmentId: enrollment.id,
    studentId: enrollment.studentId,
    enrollmentRemovedAt: enrollment.removedAt,
    courseOfferingId: enrollment.course.id,
    courseName: enrollment.course.name,
    courseTeacherId: enrollment.course.teacherId,
    courseArchivedAt: enrollment.course.archivedAt,
  };
}

function assertCourseRewardReader(
  scope: CourseRewardScope,
  actorUserId: string
): void {
  if (
    actorUserId !== scope.courseTeacherId &&
    actorUserId !== scope.studentId
  ) {
    throw new Forbidden("reward_ledger_forbidden");
  }
}

function assertCourseRewardWriter(
  scope: CourseRewardScope,
  actorUserId: string
): void {
  if (actorUserId !== scope.courseTeacherId) {
    throw new Forbidden("reward_not_course_owner");
  }
  if (scope.courseArchivedAt !== null) {
    throw new Forbidden("reward_course_archived");
  }
  if (scope.enrollmentRemovedAt !== null) {
    throw new Forbidden("reward_enrollment_removed");
  }
}

export async function getCourseRewardSnapshot(input: {
  enrollmentId: string;
  limit?: number;
  ctx: RewardRequestContext;
}): Promise<CourseRewardSnapshot> {
  if (!rewardEnabled(input.ctx.env)) throw new NotFound("reward_not_found");
  const limit = Math.min(
    Math.max(Math.trunc(input.limit ?? DEFAULT_LEDGER_LIMIT), 1),
    200
  );

  return db.$transaction(async (tx) => {
    const scope = await loadCourseRewardScope(tx, input.enrollmentId);
    assertCourseRewardReader(scope, input.ctx.actorUserId);
    const [aggregate, entries] = await Promise.all([
      tx.rewardLedgerEntry.aggregate({
        where: {
          economy: "COURSE",
          enrollmentId: scope.enrollmentId,
        },
        _sum: { amount: true },
      }),
      tx.rewardLedgerEntry.findMany({
        where: {
          economy: "COURSE",
          enrollmentId: scope.enrollmentId,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
        select: {
          id: true,
          kind: true,
          amount: true,
          achievementType: true,
          achievementId: true,
          reversesEntryId: true,
          reason: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      enrollmentId: scope.enrollmentId,
      courseOfferingId: scope.courseOfferingId,
      balance: aggregate._sum.amount ?? 0,
      frozen: courseRewardFrozen({
        courseArchivedAt: scope.courseArchivedAt,
        enrollmentRemovedAt: scope.enrollmentRemovedAt,
      }),
      entries: entries.map(entryView),
    };
  }, TX_OPTIONS);
}

export async function awardCourseRewardPoints(input: {
  enrollmentId: string;
  points: number;
  achievementType: RewardAchievementType;
  achievementId: string;
  reason?: string;
  now?: Date;
  ctx: RewardRequestContext;
}): Promise<RewardLedgerEntryView> {
  if (!rewardMutationsEnabled(input.ctx.env)) {
    throw new Forbidden("reward_mutations_disabled");
  }

  let points: number;
  let achievementId: string;
  let reason: string | null;
  try {
    points = normalizeRewardPoints(input.points);
    achievementId = normalizeRewardAchievementId(input.achievementId);
    reason = normalizeRewardReason(input.reason, { required: false });
  } catch (error) {
    validationFromPolicy(error);
  }
  const now = input.now ?? new Date();

  return db.$transaction(async (tx) => {
    const scope = await loadCourseRewardScope(tx, input.enrollmentId);
    assertCourseRewardWriter(scope, input.ctx.actorUserId);
    const awardKey = courseRewardAwardKey({
      enrollmentId: scope.enrollmentId,
      achievementType: input.achievementType,
      achievementId,
    });
    const inserted = await tx.rewardLedgerEntry.createMany({
      data: [
        {
          economy: "COURSE",
          studentId: scope.studentId,
          enrollmentId: scope.enrollmentId,
          courseOfferingId: scope.courseOfferingId,
          kind: "AWARD",
          amount: points,
          achievementType: input.achievementType,
          achievementId,
          awardKey,
          actorUserId: input.ctx.actorUserId,
          reason,
          createdAt: now,
        },
      ],
      skipDuplicates: true,
    });
    const entry = await tx.rewardLedgerEntry.findUnique({
      where: { awardKey },
      select: {
        id: true,
        kind: true,
        amount: true,
        achievementType: true,
        achievementId: true,
        reversesEntryId: true,
        reason: true,
        createdAt: true,
      },
    });
    if (!entry) throw new Conflict("reward_award_conflict");

    if (inserted.count === 1) {
      await audit(
        {
          actorId: input.ctx.actorUserId,
          actorRole: "TEACHER",
          action: "REWARD_POINTS_AWARDED",
          targetType: "RewardLedgerEntry",
          targetId: entry.id,
          targetLabel: scope.courseName,
          reason: reason ?? undefined,
          after: {
            enrollmentId: scope.enrollmentId,
            courseOfferingId: scope.courseOfferingId,
            amount: points,
            achievementType: input.achievementType,
            achievementId,
          },
        },
        tx
      );
    }
    return entryView(entry);
  }, TX_OPTIONS);
}

export async function reverseCourseRewardEntry(input: {
  entryId: string;
  reason: string;
  now?: Date;
  ctx: RewardRequestContext;
}): Promise<RewardLedgerEntryView> {
  if (!rewardMutationsEnabled(input.ctx.env)) {
    throw new Forbidden("reward_mutations_disabled");
  }
  let reason: string;
  try {
    reason = normalizeRewardReason(input.reason, { required: true }) as string;
  } catch (error) {
    validationFromPolicy(error);
  }
  const now = input.now ?? new Date();

  try {
    return await db.$transaction(async (tx) => {
      const original = await tx.rewardLedgerEntry.findUnique({
        where: { id: input.entryId },
        select: {
          id: true,
          economy: true,
          studentId: true,
          enrollmentId: true,
          courseOfferingId: true,
          kind: true,
          amount: true,
          achievementType: true,
          achievementId: true,
          reversedBy: { select: { id: true } },
        },
      });
      if (
        !original ||
        original.economy !== "COURSE" ||
        !original.enrollmentId ||
        !original.courseOfferingId
      ) {
        throw new NotFound("reward_entry_not_found");
      }
      const scope = await loadCourseRewardScope(tx, original.enrollmentId);
      assertCourseRewardWriter(scope, input.ctx.actorUserId);
      if (original.reversedBy) {
        throw new Conflict("reward_entry_already_reversed");
      }

      const reversal = await tx.rewardLedgerEntry.create({
        data: {
          economy: "COURSE",
          studentId: original.studentId,
          enrollmentId: original.enrollmentId,
          courseOfferingId: original.courseOfferingId,
          kind: "REVERSAL",
          amount: -original.amount,
          achievementType: original.achievementType,
          achievementId: original.achievementId,
          reversesEntryId: original.id,
          actorUserId: input.ctx.actorUserId,
          reason,
          createdAt: now,
        },
        select: {
          id: true,
          kind: true,
          amount: true,
          achievementType: true,
          achievementId: true,
          reversesEntryId: true,
          reason: true,
          createdAt: true,
        },
      });
      await audit(
        {
          actorId: input.ctx.actorUserId,
          actorRole: "TEACHER",
          action: "REWARD_ENTRY_REVERSED",
          targetType: "RewardLedgerEntry",
          targetId: reversal.id,
          targetLabel: scope.courseName,
          reason,
          before: {
            entryId: original.id,
            amount: original.amount,
          },
          after: {
            reversalEntryId: reversal.id,
            amount: reversal.amount,
          },
        },
        tx
      );
      return entryView(reversal);
    }, TX_OPTIONS);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Conflict("reward_entry_already_reversed");
    }
    throw error;
  }
}
