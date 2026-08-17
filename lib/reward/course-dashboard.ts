import type {
  RewardAchievementType,
  RewardLedgerEntryKind,
} from "@prisma/client";

import { db } from "@/lib/db/client";
import { NotFound } from "@/lib/errors";
import {
  rewardEnabled,
  type RewardFeatureFlagEnv,
} from "@/lib/reward/feature-flags";

const HISTORY_LIMIT = 50;

export type CourseRewardCandidate = {
  achievementType: Exclude<RewardAchievementType, "SYSTEM_QUEST">;
  achievementId: string;
  label: string;
  detail: string;
  awarded: boolean;
};

export type CourseRewardHistoryEntry = {
  id: string;
  kind: RewardLedgerEntryKind;
  amount: number;
  achievementType: RewardAchievementType;
  achievementId: string;
  reason: string | null;
  createdAt: Date;
  reversesEntryId: string | null;
  reversible: boolean;
};

export type TeacherCourseRewardMember = {
  enrollmentId: string;
  student: {
    userId: string;
    firstName: string;
    lastName: string;
    profileImageId: string | null;
  };
  balance: number;
  candidates: CourseRewardCandidate[];
  entries: CourseRewardHistoryEntry[];
};

export type TeacherCourseRewardDashboard = {
  courseOfferingId: string;
  totalBalance: number;
  membersWithPoints: number;
  members: TeacherCourseRewardMember[];
};

export type StudentCourseRewardDashboard = {
  enrollmentId: string;
  courseOfferingId: string;
  balance: number;
  entries: CourseRewardHistoryEntry[];
};

type DashboardContext = {
  actorUserId: string;
  env?: RewardFeatureFlagEnv;
};

function requireRewardRead(env?: RewardFeatureFlagEnv): void {
  if (!rewardEnabled(env)) throw new NotFound("reward_not_found");
}

function historyEntry(entry: {
  id: string;
  kind: RewardLedgerEntryKind;
  amount: number;
  achievementType: RewardAchievementType;
  achievementId: string;
  reason: string | null;
  createdAt: Date;
  reversesEntryId: string | null;
  reversedBy: { id: string } | null;
}): CourseRewardHistoryEntry {
  return {
    id: entry.id,
    kind: entry.kind,
    amount: entry.amount,
    achievementType: entry.achievementType,
    achievementId: entry.achievementId,
    reason: entry.reason,
    createdAt: entry.createdAt,
    reversesEntryId: entry.reversesEntryId,
    reversible: entry.reversedBy === null,
  };
}

/**
 * Teacher projection for one active course. Peer balances intentionally stay
 * on this teacher-only surface; the student projection below never queries
 * another Enrollment.
 */
export async function getTeacherCourseRewardDashboard(input: {
  courseOfferingId: string;
  ctx: DashboardContext;
}): Promise<TeacherCourseRewardDashboard> {
  requireRewardRead(input.ctx.env);

  const course = await db.courseOffering.findFirst({
    where: {
      id: input.courseOfferingId,
      teacherId: input.ctx.actorUserId,
      archivedAt: null,
    },
    select: {
      id: true,
      enrollments: {
        where: { removedAt: null },
        orderBy: [
          { student: { firstName: "asc" } },
          { student: { lastName: "asc" } },
        ],
        select: {
          id: true,
          student: {
            select: {
              userId: true,
              firstName: true,
              lastName: true,
              user: { select: { profileImageId: true } },
            },
          },
          rewardEntries: {
            where: { economy: "COURSE" },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: HISTORY_LIMIT,
            select: {
              id: true,
              kind: true,
              amount: true,
              achievementType: true,
              achievementId: true,
              reason: true,
              createdAt: true,
              reversesEntryId: true,
              reversedBy: { select: { id: true } },
            },
          },
          submissions: {
            where: { status: { not: "DRAFT" } },
            orderBy: { updatedAt: "desc" },
            take: 20,
            select: {
              assignment: { select: { id: true, title: true } },
              status: true,
              updatedAt: true,
            },
          },
          attendanceRecords: {
            where: { status: "PRESENT" },
            orderBy: { markedAt: "desc" },
            take: 20,
            select: {
              session: { select: { id: true, scheduledStart: true } },
            },
          },
          scoreEntries: {
            where: { scoreItem: { publishedAt: { not: null } } },
            orderBy: { updatedAt: "desc" },
            take: 20,
            select: {
              value: true,
              scoreItem: {
                select: { id: true, name: true, fullScore: true },
              },
            },
          },
        },
      },
    },
  });
  if (!course) throw new NotFound("reward_course_not_found");

  const [balanceRows, awardRows] = await Promise.all([
    db.rewardLedgerEntry.groupBy({
      by: ["enrollmentId"],
      where: {
        economy: "COURSE",
        courseOfferingId: course.id,
        enrollmentId: { not: null },
      },
      _sum: { amount: true },
    }),
    db.rewardLedgerEntry.findMany({
      where: {
        economy: "COURSE",
        courseOfferingId: course.id,
        kind: "AWARD",
        enrollmentId: { not: null },
      },
      select: {
        enrollmentId: true,
        achievementType: true,
        achievementId: true,
      },
    }),
  ]);
  const balanceByEnrollment = new Map(
    balanceRows.map((row) => [row.enrollmentId, row._sum.amount ?? 0])
  );
  const awardedByEnrollment = new Map<string, Set<string>>();
  for (const row of awardRows) {
    if (!row.enrollmentId) continue;
    const keys = awardedByEnrollment.get(row.enrollmentId) ?? new Set<string>();
    keys.add(`${row.achievementType}:${row.achievementId}`);
    awardedByEnrollment.set(row.enrollmentId, keys);
  }

  const date = new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const members = course.enrollments.map((enrollment) => {
    const awarded = awardedByEnrollment.get(enrollment.id) ?? new Set<string>();
    const candidates: CourseRewardCandidate[] = [
      ...enrollment.submissions.map((submission) => ({
        achievementType: "ASSIGNMENT_SUBMITTED" as const,
        achievementId: submission.assignment.id,
        label: submission.assignment.title,
        detail:
          submission.status === "LATE_SUBMITTED"
            ? "ส่งงานแล้ว (ส่งช้า)"
            : "ส่งงานแล้ว",
        awarded: awarded.has(
          `ASSIGNMENT_SUBMITTED:${submission.assignment.id}`
        ),
      })),
      ...enrollment.attendanceRecords.map((record) => ({
        achievementType: "ATTENDANCE_PRESENT" as const,
        achievementId: record.session.id,
        label: `เข้าเรียน ${date.format(record.session.scheduledStart)}`,
        detail: "เช็คชื่อว่ามาเรียน",
        awarded: awarded.has(`ATTENDANCE_PRESENT:${record.session.id}`),
      })),
      ...enrollment.scoreEntries.map((entry) => ({
        achievementType: "SCORE_THRESHOLD" as const,
        achievementId: entry.scoreItem.id,
        label: entry.scoreItem.name,
        detail: `ได้ ${entry.value}/${entry.scoreItem.fullScore} คะแนน`,
        awarded: awarded.has(`SCORE_THRESHOLD:${entry.scoreItem.id}`),
      })),
    ];
    const entries = enrollment.rewardEntries.map(historyEntry);
    return {
      enrollmentId: enrollment.id,
      student: {
        userId: enrollment.student.userId,
        firstName: enrollment.student.firstName,
        lastName: enrollment.student.lastName,
        profileImageId: enrollment.student.user.profileImageId,
      },
      balance: balanceByEnrollment.get(enrollment.id) ?? 0,
      candidates,
      entries,
    };
  });

  return {
    courseOfferingId: course.id,
    totalBalance: members.reduce((sum, member) => sum + member.balance, 0),
    membersWithPoints: members.filter((member) => member.balance !== 0).length,
    members,
  };
}

/** Student-safe projection: exact current user's active Enrollment only. */
export async function getStudentCourseRewardDashboard(input: {
  courseOfferingId: string;
  ctx: DashboardContext;
}): Promise<StudentCourseRewardDashboard> {
  requireRewardRead(input.ctx.env);

  const enrollment = await db.enrollment.findFirst({
    where: {
      courseOfferingId: input.courseOfferingId,
      studentId: input.ctx.actorUserId,
      removedAt: null,
      course: { archivedAt: null },
    },
    select: {
      id: true,
      courseOfferingId: true,
      rewardEntries: {
        where: { economy: "COURSE" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: HISTORY_LIMIT,
        select: {
          id: true,
          kind: true,
          amount: true,
          achievementType: true,
          achievementId: true,
          reason: true,
          createdAt: true,
          reversesEntryId: true,
          reversedBy: { select: { id: true } },
        },
      },
    },
  });
  if (!enrollment) throw new NotFound("reward_enrollment_not_found");

  const entries = enrollment.rewardEntries.map(historyEntry);
  const aggregate = await db.rewardLedgerEntry.aggregate({
    where: { economy: "COURSE", enrollmentId: enrollment.id },
    _sum: { amount: true },
  });
  return {
    enrollmentId: enrollment.id,
    courseOfferingId: enrollment.courseOfferingId,
    balance: aggregate._sum.amount ?? 0,
    entries,
  };
}
