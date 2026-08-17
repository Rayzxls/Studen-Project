import { Prisma, type CourseRewardClaimStatus } from "@prisma/client";

import { audit } from "@/lib/audit/log";
import { db } from "@/lib/db/client";
import { Conflict, Forbidden, NotFound, ValidationError } from "@/lib/errors";
import {
  courseRewardMilestoneMutationsEnabled,
  courseRewardMilestonesEnabled,
  type RewardFeatureFlagEnv,
} from "@/lib/reward/feature-flags";
import {
  courseRewardScoreSnapshot,
  highestEligibleCourseRewardTier,
  normalizeCourseRewardResolutionReason,
  normalizeCourseRewardTierInput,
  scoreSnapshotMeetsThreshold,
  type CourseRewardScoreSnapshot,
} from "@/lib/reward/milestone-policy";

const TX_OPTIONS = {
  maxWait: 10_000,
  timeout: 20_000,
  isolationLevel: "Serializable" as const,
};

export type CourseRewardMilestoneContext = {
  actorUserId: string;
  env?: RewardFeatureFlagEnv;
};

export type CourseRewardTierView = {
  id: string;
  title: string;
  description: string | null;
  fulfillmentInstructions: string | null;
  requiredScore: number;
  version: number;
  archivedAt: Date | null;
};

export type CourseRewardClaimView = {
  id: string;
  tierId: string;
  enrollmentId: string;
  attempt: number;
  status: CourseRewardClaimStatus;
  snapshotTierTitle: string;
  snapshotTierDescription: string | null;
  snapshotTierFulfillmentInstructions: string | null;
  snapshotTierRequiredScore: number;
  snapshotTierVersion: number;
  snapshotScorePercent: number;
  snapshotEarnedScore: number;
  snapshotPublishedFullScore: number;
  requestedAt: Date | null;
  resolvedAt: Date | null;
  resolutionReason: string | null;
  supersededByClaimId: string | null;
};

export type TeacherCourseRewardMilestoneDashboard = {
  courseOfferingId: string;
  tiers: CourseRewardTierView[];
  pendingClaims: TeacherCourseRewardClaimItem[];
  recentClaims: TeacherCourseRewardClaimItem[];
};

export type TeacherCourseRewardClaimItem = CourseRewardClaimView & {
  student: {
    userId: string;
    firstName: string;
    lastName: string;
    profileImageId: string | null;
  };
};

export type StudentCourseRewardTierItem = CourseRewardTierView & {
  latestClaim: CourseRewardClaimView | null;
};

export type StudentCourseRewardMilestoneDashboard = {
  courseOfferingId: string;
  enrollmentId: string;
  score: CourseRewardScoreSnapshot | null;
  tiers: StudentCourseRewardTierItem[];
  claims: CourseRewardClaimView[];
  claimableTierId: string | null;
  pendingClaimId: string | null;
};

type ClaimProjection = CourseRewardClaimView;

function policyValidation(error: unknown): never {
  const code = error instanceof Error ? error.message : "reward_invalid";
  throw new ValidationError({ reward: code }, code);
}

function claimView(claim: ClaimProjection): CourseRewardClaimView {
  return { ...claim };
}

const CLAIM_SELECT = {
  id: true,
  tierId: true,
  enrollmentId: true,
  attempt: true,
  status: true,
  snapshotTierTitle: true,
  snapshotTierDescription: true,
  snapshotTierFulfillmentInstructions: true,
  snapshotTierRequiredScore: true,
  snapshotTierVersion: true,
  snapshotScorePercent: true,
  snapshotEarnedScore: true,
  snapshotPublishedFullScore: true,
  requestedAt: true,
  resolvedAt: true,
  resolutionReason: true,
  supersededByClaimId: true,
} satisfies Prisma.CourseRewardClaimSelect;

function tierSnapshotData(
  tier: CourseRewardTierView,
  snapshot: CourseRewardScoreSnapshot
) {
  return {
    snapshotTierTitle: tier.title,
    snapshotTierDescription: tier.description,
    snapshotTierFulfillmentInstructions: tier.fulfillmentInstructions,
    snapshotTierRequiredScore: tier.requiredScore,
    snapshotTierVersion: tier.version,
    snapshotScorePercent: snapshot.percent,
    snapshotEarnedScore: snapshot.earnedScore,
    snapshotPublishedFullScore: snapshot.publishedFullScore,
  };
}

export async function createCourseRewardTier(input: {
  courseOfferingId: string;
  title: string;
  description?: string | null;
  fulfillmentInstructions?: string | null;
  requiredScore: number;
  now?: Date;
  ctx: CourseRewardMilestoneContext;
}): Promise<CourseRewardTierView> {
  if (!courseRewardMilestoneMutationsEnabled(input.ctx.env)) {
    throw new Forbidden("course_reward_milestone_mutations_disabled");
  }

  let normalized: ReturnType<typeof normalizeCourseRewardTierInput>;
  try {
    normalized = normalizeCourseRewardTierInput(input);
  } catch (error) {
    policyValidation(error);
  }
  const now = input.now ?? new Date();

  try {
    return await db.$transaction(async (tx) => {
      const course = await tx.courseOffering.findUnique({
        where: { id: input.courseOfferingId },
        select: { id: true, name: true, teacherId: true, archivedAt: true },
      });
      if (!course) throw new NotFound("course_reward_course_not_found");
      if (course.teacherId !== input.ctx.actorUserId) {
        throw new Forbidden("course_reward_not_course_owner");
      }
      if (course.archivedAt !== null) {
        throw new Forbidden("course_reward_course_archived");
      }

      const tier = await tx.courseRewardTier.create({
        data: {
          courseOfferingId: course.id,
          ...normalized,
          createdAt: now,
          revisions: {
            create: {
              version: 1,
              ...normalized,
              archivedAt: null,
              actorUserId: input.ctx.actorUserId,
              createdAt: now,
            },
          },
        },
        select: {
          id: true,
          title: true,
          description: true,
          fulfillmentInstructions: true,
          requiredScore: true,
          version: true,
          archivedAt: true,
        },
      });

      await audit(
        {
          actorId: input.ctx.actorUserId,
          actorRole: "TEACHER",
          action: "COURSE_REWARD_TIER_CREATED",
          targetType: "CourseRewardTier",
          targetId: tier.id,
          targetLabel: `${tier.title} (${course.name})`,
          after: {
            courseOfferingId: course.id,
            requiredScore: tier.requiredScore,
            version: tier.version,
          },
        },
        tx
      );
      return tier;
    }, TX_OPTIONS);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Conflict("course_reward_threshold_exists");
    }
    throw error;
  }
}

type EnrollmentClaimScope = {
  enrollmentId: string;
  studentUserId: string;
  removedAt: Date | null;
  course: {
    id: string;
    name: string;
    teacherId: string;
    archivedAt: Date | null;
  };
  scoreItems: {
    id: string;
    fullScore: number;
    publishedAt: Date | null;
    entries: { scoreItemId: string; value: number }[];
  }[];
};

async function loadEnrollmentClaimScope(
  tx: Prisma.TransactionClient,
  enrollmentId: string
): Promise<EnrollmentClaimScope> {
  const enrollment = await tx.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      studentId: true, // dependency-gate-allow(student-id-symbol-review): internal Enrollment foreign key to User.id
      removedAt: true,
      course: {
        select: {
          id: true,
          name: true,
          teacherId: true,
          archivedAt: true,
          scoreItems: {
            select: {
              id: true,
              fullScore: true,
              publishedAt: true,
              entries: {
                where: { enrollmentId },
                select: { scoreItemId: true, value: true },
              },
            },
          },
        },
      },
    },
  });
  if (!enrollment) throw new NotFound("course_reward_enrollment_not_found");
  return {
    enrollmentId: enrollment.id,
    studentUserId: enrollment.studentId, // dependency-gate-allow(student-id-symbol-review): map the internal Enrollment FK to an explicit User.id name
    removedAt: enrollment.removedAt,
    course: {
      id: enrollment.course.id,
      name: enrollment.course.name,
      teacherId: enrollment.course.teacherId,
      archivedAt: enrollment.course.archivedAt,
    },
    scoreItems: enrollment.course.scoreItems,
  };
}

function scoreSnapshotFromScope(
  scope: EnrollmentClaimScope
): CourseRewardScoreSnapshot | null {
  return courseRewardScoreSnapshot(
    scope.scoreItems,
    scope.scoreItems.flatMap((item) => item.entries)
  );
}

export async function claimHighestEligibleCourseReward(input: {
  enrollmentId: string;
  now?: Date;
  ctx: CourseRewardMilestoneContext;
}): Promise<CourseRewardClaimView> {
  if (!courseRewardMilestoneMutationsEnabled(input.ctx.env)) {
    throw new Forbidden("course_reward_milestone_mutations_disabled");
  }
  const now = input.now ?? new Date();

  const execute = () =>
    db.$transaction(async (tx) => {
      const scope = await loadEnrollmentClaimScope(tx, input.enrollmentId);
      if (scope.studentUserId !== input.ctx.actorUserId) {
        throw new Forbidden("course_reward_claim_not_student");
      }
      if (scope.course.archivedAt !== null) {
        throw new Forbidden("course_reward_course_archived");
      }
      if (scope.removedAt !== null) {
        throw new Forbidden("course_reward_enrollment_removed");
      }

      const pending = await tx.courseRewardClaim.findFirst({
        where: { enrollmentId: scope.enrollmentId, status: "PENDING" },
        select: CLAIM_SELECT,
      });
      if (pending) return claimView(pending);

      const snapshot = scoreSnapshotFromScope(scope);
      if (!snapshot) throw new Conflict("course_reward_no_published_score");

      const tiers = await tx.courseRewardTier.findMany({
        where: {
          courseOfferingId: scope.course.id,
          archivedAt: null,
        },
        orderBy: [{ requiredScore: "desc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          fulfillmentInstructions: true,
          requiredScore: true,
          version: true,
          archivedAt: true,
          claims: {
            where: { enrollmentId: scope.enrollmentId },
            select: { attempt: true, status: true },
            orderBy: { attempt: "desc" },
          },
        },
      });
      const available = tiers.filter(
        (tier) =>
          !tier.claims.some((claim) =>
            (["PENDING", "FULFILLED", "SUPERSEDED"] as const).includes(
              claim.status as "PENDING" | "FULFILLED" | "SUPERSEDED"
            )
          )
      );
      const selected = highestEligibleCourseRewardTier(available, snapshot);
      if (!selected) throw new Conflict("course_reward_no_eligible_tier");

      const selectedClaim = await tx.courseRewardClaim.create({
        data: {
          tierId: selected.id,
          enrollmentId: scope.enrollmentId,
          attempt: (selected.claims[0]?.attempt ?? 0) + 1,
          status: "PENDING",
          ...tierSnapshotData(selected, snapshot),
          requestedAt: now,
          createdAt: now,
        },
        select: CLAIM_SELECT,
      });

      const lowerEligible = available.filter(
        (tier) =>
          tier.id !== selected.id &&
          tier.requiredScore < selected.requiredScore &&
          scoreSnapshotMeetsThreshold(snapshot, tier.requiredScore)
      );
      if (lowerEligible.length > 0) {
        await tx.courseRewardClaim.createMany({
          data: lowerEligible.map((tier) => ({
            tierId: tier.id,
            enrollmentId: scope.enrollmentId,
            attempt: (tier.claims[0]?.attempt ?? 0) + 1,
            status: "SUPERSEDED" as const,
            ...tierSnapshotData(tier, snapshot),
            requestedAt: null,
            resolvedAt: now,
            supersededByClaimId: selectedClaim.id,
            createdAt: now,
          })),
        });
      }

      await audit(
        {
          actorId: input.ctx.actorUserId,
          actorRole: "STUDENT",
          action: "COURSE_REWARD_CLAIM_REQUESTED",
          targetType: "CourseRewardClaim",
          targetId: selectedClaim.id,
          targetLabel: `${selected.title} (${scope.course.name})`,
          after: {
            enrollmentId: scope.enrollmentId,
            courseOfferingId: scope.course.id,
            tierId: selected.id,
            requiredScore: selected.requiredScore,
            scorePercent: snapshot.percent,
            earnedScore: snapshot.earnedScore,
            publishedFullScore: snapshot.publishedFullScore,
            supersededTierIds: lowerEligible.map((tier) => tier.id),
          },
        },
        tx
      );
      return claimView(selectedClaim);
    }, TX_OPTIONS);

  try {
    return await execute();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2002" || error.code === "P2034")
    ) {
      const pending = await db.courseRewardClaim.findFirst({
        where: {
          enrollmentId: input.enrollmentId,
          status: "PENDING",
          enrollment: {
            studentId: input.ctx.actorUserId, // dependency-gate-allow(student-id-symbol-review): internal Enrollment foreign key to User.id
          },
        },
        select: CLAIM_SELECT,
      });
      if (pending) return claimView(pending);
    }
    throw error;
  }
}

export async function resolveCourseRewardClaim(input: {
  claimId: string;
  outcome: "FULFILLED" | "REJECTED";
  reason?: string | null;
  now?: Date;
  ctx: CourseRewardMilestoneContext;
}): Promise<CourseRewardClaimView> {
  if (!courseRewardMilestoneMutationsEnabled(input.ctx.env)) {
    throw new Forbidden("course_reward_milestone_mutations_disabled");
  }

  let reason: string | null;
  try {
    reason = normalizeCourseRewardResolutionReason(input.reason, {
      required: input.outcome === "REJECTED",
    });
  } catch (error) {
    policyValidation(error);
  }
  const now = input.now ?? new Date();

  return db.$transaction(async (tx) => {
    const claim = await tx.courseRewardClaim.findUnique({
      where: { id: input.claimId },
      select: {
        id: true,
        status: true,
        snapshotTierTitle: true,
        tier: {
          select: {
            course: {
              select: {
                id: true,
                name: true,
                teacherId: true,
                archivedAt: true,
              },
            },
          },
        },
        enrollment: { select: { removedAt: true } },
      },
    });
    if (!claim) throw new NotFound("course_reward_claim_not_found");
    if (claim.tier.course.teacherId !== input.ctx.actorUserId) {
      throw new Forbidden("course_reward_not_course_owner");
    }
    if (claim.tier.course.archivedAt !== null) {
      throw new Forbidden("course_reward_course_archived");
    }
    if (claim.enrollment.removedAt !== null) {
      throw new Forbidden("course_reward_enrollment_removed");
    }
    if (claim.status !== "PENDING") {
      throw new Conflict("course_reward_claim_already_resolved");
    }

    const updated = await tx.courseRewardClaim.updateMany({
      where: { id: claim.id, status: "PENDING" },
      data: {
        status: input.outcome,
        resolvedAt: now,
        resolvedByUserId: input.ctx.actorUserId,
        resolutionReason: reason,
      },
    });
    if (updated.count !== 1) {
      throw new Conflict("course_reward_claim_already_resolved");
    }

    const resolved = await tx.courseRewardClaim.findUniqueOrThrow({
      where: { id: claim.id },
      select: CLAIM_SELECT,
    });
    await audit(
      {
        actorId: input.ctx.actorUserId,
        actorRole: "TEACHER",
        action:
          input.outcome === "FULFILLED"
            ? "COURSE_REWARD_CLAIM_FULFILLED"
            : "COURSE_REWARD_CLAIM_REJECTED",
        targetType: "CourseRewardClaim",
        targetId: claim.id,
        targetLabel: `${claim.snapshotTierTitle} (${claim.tier.course.name})`,
        reason: reason ?? undefined,
        after: {
          courseOfferingId: claim.tier.course.id,
          status: input.outcome,
        },
      },
      tx
    );
    return claimView(resolved);
  }, TX_OPTIONS);
}

export async function listCourseRewardTiers(input: {
  courseOfferingId: string;
  includeArchived?: boolean;
  ctx: CourseRewardMilestoneContext;
}): Promise<CourseRewardTierView[]> {
  if (!courseRewardMilestonesEnabled(input.ctx.env)) {
    throw new NotFound("course_reward_milestones_not_found");
  }
  const course = await db.courseOffering.findUnique({
    where: { id: input.courseOfferingId },
    select: {
      teacherId: true,
      enrollments: {
        where: {
          studentId: input.ctx.actorUserId, // dependency-gate-allow(student-id-symbol-review): internal Enrollment foreign key to User.id
        },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!course) throw new NotFound("course_reward_course_not_found");
  const isTeacher = course.teacherId === input.ctx.actorUserId;
  if (!isTeacher && course.enrollments.length === 0) {
    throw new Forbidden("course_reward_tiers_forbidden");
  }

  return db.courseRewardTier.findMany({
    where: {
      courseOfferingId: input.courseOfferingId,
      ...(!isTeacher || !input.includeArchived ? { archivedAt: null } : {}),
    },
    orderBy: [{ requiredScore: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      fulfillmentInstructions: true,
      requiredScore: true,
      version: true,
      archivedAt: true,
    },
  });
}

export async function updateCourseRewardTier(input: {
  tierId: string;
  title: string;
  description?: string | null;
  fulfillmentInstructions?: string | null;
  requiredScore: number;
  now?: Date;
  ctx: CourseRewardMilestoneContext;
}): Promise<CourseRewardTierView> {
  if (!courseRewardMilestoneMutationsEnabled(input.ctx.env)) {
    throw new Forbidden("course_reward_milestone_mutations_disabled");
  }

  let normalized: ReturnType<typeof normalizeCourseRewardTierInput>;
  try {
    normalized = normalizeCourseRewardTierInput(input);
  } catch (error) {
    policyValidation(error);
  }
  const now = input.now ?? new Date();

  try {
    return await db.$transaction(async (tx) => {
      const current = await tx.courseRewardTier.findUnique({
        where: { id: input.tierId },
        select: {
          id: true,
          version: true,
          archivedAt: true,
          course: {
            select: { id: true, name: true, teacherId: true, archivedAt: true },
          },
        },
      });
      if (!current) throw new NotFound("course_reward_tier_not_found");
      if (current.course.teacherId !== input.ctx.actorUserId) {
        throw new Forbidden("course_reward_not_course_owner");
      }
      if (current.course.archivedAt !== null || current.archivedAt !== null) {
        throw new Forbidden("course_reward_tier_archived");
      }

      const nextVersion = current.version + 1;
      const updated = await tx.courseRewardTier.updateMany({
        where: { id: current.id, version: current.version, archivedAt: null },
        data: { ...normalized, version: nextVersion },
      });
      if (updated.count !== 1) {
        throw new Conflict("course_reward_tier_changed");
      }
      await tx.courseRewardTierRevision.create({
        data: {
          tierId: current.id,
          version: nextVersion,
          ...normalized,
          archivedAt: null,
          actorUserId: input.ctx.actorUserId,
          createdAt: now,
        },
      });
      const tier = await tx.courseRewardTier.findUniqueOrThrow({
        where: { id: current.id },
        select: {
          id: true,
          title: true,
          description: true,
          fulfillmentInstructions: true,
          requiredScore: true,
          version: true,
          archivedAt: true,
        },
      });
      await audit(
        {
          actorId: input.ctx.actorUserId,
          actorRole: "TEACHER",
          action: "COURSE_REWARD_TIER_UPDATED",
          targetType: "CourseRewardTier",
          targetId: tier.id,
          targetLabel: `${tier.title} (${current.course.name})`,
          after: {
            courseOfferingId: current.course.id,
            requiredScore: tier.requiredScore,
            version: tier.version,
          },
        },
        tx
      );
      return tier;
    }, TX_OPTIONS);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Conflict("course_reward_threshold_exists");
    }
    throw error;
  }
}

export async function archiveCourseRewardTier(input: {
  tierId: string;
  now?: Date;
  ctx: CourseRewardMilestoneContext;
}): Promise<CourseRewardTierView> {
  if (!courseRewardMilestoneMutationsEnabled(input.ctx.env)) {
    throw new Forbidden("course_reward_milestone_mutations_disabled");
  }
  const now = input.now ?? new Date();

  return db.$transaction(async (tx) => {
    const current = await tx.courseRewardTier.findUnique({
      where: { id: input.tierId },
      select: {
        id: true,
        title: true,
        description: true,
        fulfillmentInstructions: true,
        requiredScore: true,
        version: true,
        archivedAt: true,
        course: {
          select: { id: true, name: true, teacherId: true, archivedAt: true },
        },
      },
    });
    if (!current) throw new NotFound("course_reward_tier_not_found");
    if (current.course.teacherId !== input.ctx.actorUserId) {
      throw new Forbidden("course_reward_not_course_owner");
    }
    if (current.course.archivedAt !== null) {
      throw new Forbidden("course_reward_course_archived");
    }
    if (current.archivedAt !== null) return current;

    const nextVersion = current.version + 1;
    const updated = await tx.courseRewardTier.updateMany({
      where: { id: current.id, version: current.version, archivedAt: null },
      data: { archivedAt: now, version: nextVersion },
    });
    if (updated.count !== 1) {
      throw new Conflict("course_reward_tier_changed");
    }
    await tx.courseRewardTierRevision.create({
      data: {
        tierId: current.id,
        version: nextVersion,
        title: current.title,
        description: current.description,
        fulfillmentInstructions: current.fulfillmentInstructions,
        requiredScore: current.requiredScore,
        archivedAt: now,
        actorUserId: input.ctx.actorUserId,
        createdAt: now,
      },
    });
    const tier = await tx.courseRewardTier.findUniqueOrThrow({
      where: { id: current.id },
      select: {
        id: true,
        title: true,
        description: true,
        fulfillmentInstructions: true,
        requiredScore: true,
        version: true,
        archivedAt: true,
      },
    });
    await audit(
      {
        actorId: input.ctx.actorUserId,
        actorRole: "TEACHER",
        action: "COURSE_REWARD_TIER_ARCHIVED",
        targetType: "CourseRewardTier",
        targetId: tier.id,
        targetLabel: `${tier.title} (${current.course.name})`,
        after: {
          courseOfferingId: current.course.id,
          requiredScore: tier.requiredScore,
          version: tier.version,
          archivedAt: now.toISOString(),
        },
      },
      tx
    );
    return tier;
  }, TX_OPTIONS);
}

const CLAIM_WITH_STUDENT_SELECT = {
  ...CLAIM_SELECT,
  enrollment: {
    select: {
      student: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          user: { select: { profileImageId: true } },
        },
      },
    },
  },
} satisfies Prisma.CourseRewardClaimSelect;

function teacherClaimItem(
  claim: Prisma.CourseRewardClaimGetPayload<{
    select: typeof CLAIM_WITH_STUDENT_SELECT;
  }>
): TeacherCourseRewardClaimItem {
  const { enrollment, ...view } = claim;
  return {
    ...view,
    student: {
      userId: enrollment.student.userId,
      firstName: enrollment.student.firstName,
      lastName: enrollment.student.lastName,
      profileImageId: enrollment.student.user.profileImageId,
    },
  };
}

export async function getTeacherCourseRewardMilestoneDashboard(input: {
  courseOfferingId: string;
  ctx: CourseRewardMilestoneContext;
}): Promise<TeacherCourseRewardMilestoneDashboard> {
  if (!courseRewardMilestonesEnabled(input.ctx.env)) {
    throw new NotFound("course_reward_milestones_not_found");
  }
  const course = await db.courseOffering.findUnique({
    where: { id: input.courseOfferingId },
    select: { id: true, teacherId: true },
  });
  if (!course) throw new NotFound("course_reward_course_not_found");
  if (course.teacherId !== input.ctx.actorUserId) {
    throw new Forbidden("course_reward_not_course_owner");
  }

  const [tiers, pendingClaims, recentClaims] = await Promise.all([
    db.courseRewardTier.findMany({
      where: { courseOfferingId: course.id, archivedAt: null },
      orderBy: [{ requiredScore: "asc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        fulfillmentInstructions: true,
        requiredScore: true,
        version: true,
        archivedAt: true,
      },
    }),
    db.courseRewardClaim.findMany({
      where: {
        status: "PENDING",
        tier: { courseOfferingId: course.id },
        enrollment: { removedAt: null },
      },
      orderBy: [{ requestedAt: "asc" }, { id: "asc" }],
      select: CLAIM_WITH_STUDENT_SELECT,
    }),
    db.courseRewardClaim.findMany({
      where: {
        status: { in: ["FULFILLED", "REJECTED"] },
        tier: { courseOfferingId: course.id },
      },
      orderBy: [{ resolvedAt: "desc" }, { id: "desc" }],
      take: 20,
      select: CLAIM_WITH_STUDENT_SELECT,
    }),
  ]);

  return {
    courseOfferingId: course.id,
    tiers,
    pendingClaims: pendingClaims.map(teacherClaimItem),
    recentClaims: recentClaims.map(teacherClaimItem),
  };
}

export async function getStudentCourseRewardMilestoneDashboard(input: {
  courseOfferingId: string;
  ctx: CourseRewardMilestoneContext;
}): Promise<StudentCourseRewardMilestoneDashboard> {
  if (!courseRewardMilestonesEnabled(input.ctx.env)) {
    throw new NotFound("course_reward_milestones_not_found");
  }
  const enrollment = await db.enrollment.findUnique({
    where: {
      studentId_courseOfferingId: {
        studentId: input.ctx.actorUserId, // dependency-gate-allow(student-id-symbol-review): exact self scope
        courseOfferingId: input.courseOfferingId,
      },
    },
    select: {
      id: true,
      removedAt: true,
      course: {
        select: {
          id: true,
          archivedAt: true,
          scoreItems: {
            select: {
              id: true,
              fullScore: true,
              publishedAt: true,
              entries: {
                where: {
                  enrollment: {
                    studentId: input.ctx.actorUserId, // dependency-gate-allow(student-id-symbol-review): exact self score rows
                  },
                },
                select: { scoreItemId: true, value: true },
              },
            },
          },
        },
      },
    },
  });
  if (!enrollment) throw new Forbidden("course_reward_tiers_forbidden");
  if (enrollment.removedAt !== null || enrollment.course.archivedAt !== null) {
    throw new Forbidden("course_reward_enrollment_removed");
  }

  const [tiersWithClaims, claims] = await Promise.all([
    db.courseRewardTier.findMany({
      where: { courseOfferingId: enrollment.course.id, archivedAt: null },
      orderBy: [{ requiredScore: "asc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        fulfillmentInstructions: true,
        requiredScore: true,
        version: true,
        archivedAt: true,
        claims: {
          where: { enrollmentId: enrollment.id },
          orderBy: [{ attempt: "desc" }, { createdAt: "desc" }],
          select: CLAIM_SELECT,
        },
      },
    }),
    db.courseRewardClaim.findMany({
      where: { enrollmentId: enrollment.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 30,
      select: CLAIM_SELECT,
    }),
  ]);
  const score = courseRewardScoreSnapshot(
    enrollment.course.scoreItems,
    enrollment.course.scoreItems.flatMap((item) => item.entries)
  );
  const pendingClaim = claims.find((claim) => claim.status === "PENDING");
  const available = tiersWithClaims.filter(
    (tier) =>
      !tier.claims.some((claim) =>
        (["PENDING", "FULFILLED", "SUPERSEDED"] as const).includes(
          claim.status as "PENDING" | "FULFILLED" | "SUPERSEDED"
        )
      )
  );
  const claimable =
    score && !pendingClaim
      ? highestEligibleCourseRewardTier(available, score)
      : null;

  return {
    courseOfferingId: enrollment.course.id,
    enrollmentId: enrollment.id,
    score,
    tiers: tiersWithClaims.map(({ claims: tierClaims, ...tier }) => ({
      ...tier,
      latestClaim: tierClaims[0] ? claimView(tierClaims[0]) : null,
    })),
    claims: claims.map(claimView),
    claimableTierId: claimable?.id ?? null,
    pendingClaimId: pendingClaim?.id ?? null,
  };
}
