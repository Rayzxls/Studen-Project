import type {
  ModerationCaseStatus,
  ModerationTargetType,
} from "@prisma/client";
import { db } from "@/lib/db/client";
import { moderationCenterEnabled } from "./feature-flags";

export type ModerationQueueFilter = "active" | "history" | "all";

export async function getModerationQueue(filter: ModerationQueueFilter) {
  if (!moderationCenterEnabled()) return [];

  const statuses: ModerationCaseStatus[] | undefined =
    filter === "active"
      ? ["OPEN", "IN_REVIEW", "APPEALED"]
      : filter === "history"
        ? ["RESOLVED", "DISMISSED"]
        : undefined;

  return db.moderationCase.findMany({
    where: statuses ? { status: { in: statuses } } : undefined,
    orderBy: [
      { priority: "desc" },
      { reportCount: "desc" },
      { updatedAt: "desc" },
    ],
    select: {
      id: true,
      targetType: true,
      targetLabel: true,
      courseOfferingId: true,
      status: true,
      reportCount: true,
      priority: true,
      restrictionKind: true,
      createdAt: true,
      updatedAt: true,
      ownerUser: {
        select: {
          role: true,
          teacher: { select: { firstName: true, lastName: true } },
          student: { select: { firstName: true, lastName: true } },
          admin: { select: { firstName: true, lastName: true } },
        },
      },
      reports: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { category: true },
      },
    },
    take: 100,
  });
}

export async function getModerationCaseDetail(caseId: string) {
  if (!moderationCenterEnabled()) return null;

  return db.moderationCase.findUnique({
    where: { id: caseId },
    include: {
      ownerUser: {
        select: {
          role: true,
          teacher: { select: { firstName: true, lastName: true } },
          student: { select: { firstName: true, lastName: true } },
          admin: { select: { firstName: true, lastName: true } },
        },
      },
      resolvedBy: {
        select: {
          admin: { select: { firstName: true, lastName: true } },
          identifier: true,
        },
      },
      reports: {
        orderBy: { createdAt: "asc" },
        include: {
          reporter: {
            select: {
              role: true,
              identifier: true,
              teacher: { select: { firstName: true, lastName: true } },
              student: { select: { firstName: true, lastName: true } },
              admin: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
      events: {
        orderBy: { createdAt: "asc" },
        include: {
          actorUser: {
            select: {
              role: true,
              identifier: true,
              teacher: { select: { firstName: true, lastName: true } },
              student: { select: { firstName: true, lastName: true } },
              admin: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });
}

export async function getModerationRestrictions(
  targets: Array<{ targetType: ModerationTargetType; targetId: string }>
): Promise<Map<string, "HIDDEN" | "QUARANTINED">> {
  if (!moderationCenterEnabled() || targets.length === 0) return new Map();

  const rows = await db.moderationCase.findMany({
    where: {
      restrictionKind: { not: null },
      OR: targets.map((target) => ({
        targetType: target.targetType,
        targetId: target.targetId,
      })),
    },
    select: { targetType: true, targetId: true, restrictionKind: true },
  });

  return new Map(
    rows.flatMap((row) =>
      row.restrictionKind
        ? [[`${row.targetType}:${row.targetId}`, row.restrictionKind] as const]
        : []
    )
  );
}

export async function getModerationRestriction(
  targetType: ModerationTargetType,
  targetId: string
): Promise<"HIDDEN" | "QUARANTINED" | null> {
  if (!moderationCenterEnabled()) return null;

  const row = await db.moderationCase.findFirst({
    where: { targetType, targetId, restrictionKind: { not: null } },
    orderBy: { updatedAt: "desc" },
    select: { restrictionKind: true },
  });
  return row?.restrictionKind ?? null;
}

export async function getOwnedModerationCases(ownerUserId: string) {
  if (!moderationCenterEnabled()) return [];

  return db.moderationCase.findMany({
    where: { ownerUserId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      targetType: true,
      targetLabel: true,
      status: true,
      restrictionKind: true,
      userMessage: true,
      resolvedAt: true,
      appealDeadline: true,
      appealUsed: true,
      createdAt: true,
      updatedAt: true,
      events: {
        where: { type: "APPEAL_SUBMITTED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { reason: true, createdAt: true },
      },
    },
    take: 100,
  });
}

export function moderationTargetKey(
  targetType: ModerationTargetType,
  targetId: string
): string {
  return `${targetType}:${targetId}`;
}
