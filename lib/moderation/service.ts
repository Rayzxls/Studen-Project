import type {
  CommentOwnerType,
  ModerationCaseStatus,
  ModerationReportCategory,
  ModerationRestrictionKind,
  ModerationTargetType,
  Prisma,
  Role,
} from "@prisma/client";
import { db } from "@/lib/db/client";
import { Conflict, Forbidden, NotFound, ValidationError } from "@/lib/errors";
import { moderationCenterEnabled } from "./feature-flags";
import {
  appealDeadlineFrom,
  decideAppeal,
  decideCloseCase,
  decideRestoreRestriction,
  decideStartReview,
  decideTemporaryRestriction,
} from "./policy";

const TX_OPTIONS = {
  maxWait: 10_000,
  timeout: 15_000,
  isolationLevel: "Serializable" as const,
};

const MIN_REASON = 5;
const MAX_REASON = 1_000;
const MAX_USER_MESSAGE = 500;

type Actor = { userId: string; role: Role };
type DatabaseClient = Prisma.TransactionClient | typeof db;

type ResolvedTarget = {
  targetType: ModerationTargetType;
  targetId: string;
  targetLabel: string;
  targetSnapshot: Prisma.InputJsonObject;
  courseOfferingId: string | null;
  ownerUserId: string | null;
};

export type CreateModerationReportInput = {
  actor: Actor;
  targetType: ModerationTargetType;
  targetId: string;
  category: ModerationReportCategory;
  details: string;
};

export type ModerationCaseCommand = {
  actor: Actor;
  caseId: string;
  action:
    | "START_REVIEW"
    | "HIDE"
    | "QUARANTINE"
    | "RESTORE"
    | "RESOLVE"
    | "DISMISS";
  internalReason: string;
  userMessage?: string;
};

export type AppealModerationCaseInput = {
  actor: Actor;
  caseId: string;
  reason: string;
};

function ensureEnabled(enabled?: boolean): void {
  if (!(enabled ?? moderationCenterEnabled())) {
    throw new Forbidden("moderation_center_disabled");
  }
}

function normalizedText(
  value: string,
  field: string,
  max = MAX_REASON
): string {
  const result = value.trim();
  if (result.length < MIN_REASON || result.length > max) {
    throw new ValidationError({ [field]: `moderation_${field}_invalid` });
  }
  return result;
}

function compactLabel(
  value: string | null | undefined,
  fallback: string
): string {
  const normalized = value?.trim().replace(/\s+/g, " ");
  if (!normalized) return fallback;
  return normalized.length > 120
    ? `${normalized.slice(0, 117).trimEnd()}...`
    : normalized;
}

async function assertCourseAccess(
  client: DatabaseClient,
  actor: Actor,
  courseOfferingId: string
): Promise<void> {
  if (actor.role === "ADMIN") return;

  if (actor.role === "TEACHER") {
    const owned = await client.courseOffering.count({
      where: { id: courseOfferingId, teacherId: actor.userId },
    });
    if (owned === 1) return;
  }

  if (actor.role === "STUDENT") {
    const enrollment = await client.enrollment.count({
      where: {
        courseOfferingId,
        studentId: actor.userId,
        removedAt: null,
      },
    });
    if (enrollment === 1) return;
  }

  throw new Forbidden("moderation_target_access_denied");
}

async function courseIdForCommentOwner(
  client: DatabaseClient,
  ownerType: CommentOwnerType,
  ownerId: string
): Promise<string | null> {
  if (ownerType === "ASSIGNMENT") {
    const row = await client.assignment.findUnique({
      where: { id: ownerId },
      select: { courseOfferingId: true },
    });
    return row?.courseOfferingId ?? null;
  }
  if (ownerType === "MATERIAL") {
    const row = await client.material.findUnique({
      where: { id: ownerId },
      select: { courseOfferingId: true },
    });
    return row?.courseOfferingId ?? null;
  }
  if (ownerType === "ANNOUNCEMENT") {
    const row = await client.announcement.findUnique({
      where: { id: ownerId },
      select: { courseOfferingId: true },
    });
    return row?.courseOfferingId ?? null;
  }
  const row = await client.submission.findUnique({
    where: { id: ownerId },
    select: { assignment: { select: { courseOfferingId: true } } },
  });
  return row?.assignment.courseOfferingId ?? null;
}

async function resolveTarget(
  client: DatabaseClient,
  actor: Actor,
  targetType: ModerationTargetType,
  targetId: string
): Promise<ResolvedTarget> {
  if (targetType === "ANNOUNCEMENT") {
    const row = await client.announcement.findUnique({
      where: { id: targetId },
      select: {
        title: true,
        body: true,
        linkUrls: true,
        fileAttachmentIds: true,
        postedById: true,
        courseOfferingId: true,
        deletedAt: true,
      },
    });
    if (!row || row.deletedAt)
      throw new NotFound("moderation_target_not_found");
    await assertCourseAccess(client, actor, row.courseOfferingId);
    return {
      targetType,
      targetId,
      targetLabel: compactLabel(row.title ?? row.body, "ประกาศ"),
      targetSnapshot: {
        title: row.title ?? "",
        body: row.body,
        linkUrls: jsonStrings(row.linkUrls),
        fileAttachmentIds: jsonStrings(row.fileAttachmentIds),
      },
      courseOfferingId: row.courseOfferingId,
      ownerUserId: row.postedById,
    };
  }

  if (targetType === "MATERIAL") {
    const row = await client.material.findUnique({
      where: { id: targetId },
      select: {
        title: true,
        body: true,
        linkUrls: true,
        fileAttachmentIds: true,
        postedById: true,
        courseOfferingId: true,
        deletedAt: true,
      },
    });
    if (!row || row.deletedAt)
      throw new NotFound("moderation_target_not_found");
    await assertCourseAccess(client, actor, row.courseOfferingId);
    return {
      targetType,
      targetId,
      targetLabel: compactLabel(row.title, "เอกสาร"),
      targetSnapshot: {
        title: row.title,
        body: row.body,
        linkUrls: jsonStrings(row.linkUrls),
        fileAttachmentIds: jsonStrings(row.fileAttachmentIds),
      },
      courseOfferingId: row.courseOfferingId,
      ownerUserId: row.postedById,
    };
  }

  if (targetType === "ASSIGNMENT") {
    const row = await client.assignment.findUnique({
      where: { id: targetId },
      select: {
        title: true,
        description: true,
        linkUrls: true,
        fileAttachmentIds: true,
        dueAt: true,
        createdById: true,
        courseOfferingId: true,
      },
    });
    if (!row) throw new NotFound("moderation_target_not_found");
    await assertCourseAccess(client, actor, row.courseOfferingId);
    return {
      targetType,
      targetId,
      targetLabel: compactLabel(row.title, "การบ้าน"),
      targetSnapshot: {
        title: row.title,
        description: row.description,
        linkUrls: jsonStrings(row.linkUrls),
        fileAttachmentIds: jsonStrings(row.fileAttachmentIds),
        ...(row.dueAt ? { dueAt: row.dueAt.toISOString() } : {}),
      },
      courseOfferingId: row.courseOfferingId,
      ownerUserId: row.createdById,
    };
  }

  if (targetType === "COMMENT") {
    const row = await client.comment.findUnique({
      where: { id: targetId },
      select: {
        body: true,
        authorId: true,
        ownerType: true,
        ownerId: true,
        deletedAt: true,
      },
    });
    if (!row || row.deletedAt)
      throw new NotFound("moderation_target_not_found");
    const courseOfferingId = await courseIdForCommentOwner(
      client,
      row.ownerType,
      row.ownerId
    );
    if (!courseOfferingId) throw new NotFound("moderation_target_not_found");
    await assertCourseAccess(client, actor, courseOfferingId);
    return {
      targetType,
      targetId,
      targetLabel: compactLabel(row.body, "ความคิดเห็น"),
      targetSnapshot: {
        body: row.body,
        ownerType: row.ownerType,
        ownerId: row.ownerId,
      },
      courseOfferingId,
      ownerUserId: row.authorId,
    };
  }

  if (targetType === "FILE_ATTACHMENT" || targetType === "PROFILE_IMAGE") {
    const row = await client.fileAttachment.findUnique({
      where: { id: targetId },
      select: {
        originalFilename: true,
        mimeType: true,
        sizeBytes: true,
        ownerType: true,
        ownerId: true,
        uploadedById: true,
        deletedAt: true,
      },
    });
    if (!row || row.deletedAt)
      throw new NotFound("moderation_target_not_found");
    if (targetType === "PROFILE_IMAGE") {
      if (row.ownerType !== "PROFILE_IMAGE") {
        throw new NotFound("moderation_target_not_found");
      }
      if (actor.role !== "ADMIN" && actor.userId !== row.ownerId) {
        throw new Forbidden("moderation_target_access_denied");
      }
      return {
        targetType,
        targetId,
        targetLabel: "รูปโปรไฟล์",
        targetSnapshot: {
          originalFilename: row.originalFilename,
          mimeType: row.mimeType,
          sizeBytes: row.sizeBytes,
          fileAttachmentId: targetId,
        },
        courseOfferingId: null,
        ownerUserId: row.ownerId,
      };
    }

    const courseOfferingId = await courseIdForFileOwner(
      client,
      row.ownerType,
      row.ownerId
    );
    if (!courseOfferingId) throw new NotFound("moderation_target_not_found");
    await assertCourseAccess(client, actor, courseOfferingId);
    return {
      targetType,
      targetId,
      targetLabel: compactLabel(row.originalFilename, "ไฟล์แนบ"),
      targetSnapshot: {
        originalFilename: row.originalFilename,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        ownerType: row.ownerType,
        ownerId: row.ownerId,
        fileAttachmentId: targetId,
      },
      courseOfferingId,
      ownerUserId: row.uploadedById,
    };
  }

  throw new NotFound("moderation_target_not_found");
}

function jsonStrings(value: Prisma.JsonValue): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

async function courseIdForFileOwner(
  client: DatabaseClient,
  ownerType:
    | "ASSIGNMENT"
    | "MATERIAL"
    | "ANNOUNCEMENT"
    | "SUBMISSION"
    | "COMMENT"
    | "PROFILE_IMAGE",
  ownerId: string
): Promise<string | null> {
  if (ownerType === "PROFILE_IMAGE") return null;
  if (ownerType === "COMMENT") {
    const comment = await client.comment.findUnique({
      where: { id: ownerId },
      select: { ownerType: true, ownerId: true },
    });
    return comment
      ? courseIdForCommentOwner(client, comment.ownerType, comment.ownerId)
      : null;
  }
  return courseIdForCommentOwner(client, ownerType, ownerId);
}

function priorityForCategory(category: ModerationReportCategory): number {
  if (category === "PRIVACY" || category === "HARASSMENT") return 30;
  if (category === "INAPPROPRIATE_CONTENT") return 20;
  return 10;
}

export async function createModerationReport(
  input: CreateModerationReportInput,
  options: { enabled?: boolean } = {}
): Promise<{ caseId: string; duplicate: boolean; reportCount: number }> {
  ensureEnabled(options.enabled);
  const details = normalizedText(input.details, "details");

  return db.$transaction(async (tx) => {
    const target = await resolveTarget(
      tx,
      input.actor,
      input.targetType,
      input.targetId
    );
    const activeKey = `${target.targetType}:${target.targetId}`;
    let moderationCase = await tx.moderationCase.findUnique({
      where: { activeKey },
      select: { id: true, reportCount: true },
    });

    if (!moderationCase) {
      const created = await tx.moderationCase.create({
        data: {
          activeKey,
          ...target,
          priority: priorityForCategory(input.category),
          reportCount: 1,
          reports: {
            create: {
              reporterId: input.actor.userId,
              category: input.category,
              details,
            },
          },
          events: {
            create: {
              actorUserId: input.actor.userId,
              type: "REPORT_ADDED",
              reason: details,
              metadata: { category: input.category },
            },
          },
        },
        select: { id: true, reportCount: true },
      });
      moderationCase = created;
    } else {
      const duplicate = await tx.moderationReport.findUnique({
        where: {
          caseId_reporterId: {
            caseId: moderationCase.id,
            reporterId: input.actor.userId,
          },
        },
        select: { id: true },
      });
      if (duplicate) {
        return {
          caseId: moderationCase.id,
          duplicate: true,
          reportCount: moderationCase.reportCount,
        };
      }

      moderationCase = await tx.moderationCase.update({
        where: { id: moderationCase.id },
        data: {
          reportCount: { increment: 1 },
          priority: { increment: priorityForCategory(input.category) },
          reports: {
            create: {
              reporterId: input.actor.userId,
              category: input.category,
              details,
            },
          },
          events: {
            create: {
              actorUserId: input.actor.userId,
              type: "REPORT_ADDED",
              reason: details,
              metadata: { category: input.category },
            },
          },
        },
        select: { id: true, reportCount: true },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: input.actor.userId,
        actorRole: input.actor.role,
        action: "MODERATION_REPORT_ADDED",
        targetType: "ModerationCase",
        targetId: moderationCase.id,
        targetLabel: target.targetLabel,
        after: {
          reportedTargetType: target.targetType,
          reportedTargetId: target.targetId,
          reportCount: moderationCase.reportCount,
          category: input.category,
        },
        reason: details,
      },
    });

    return {
      caseId: moderationCase.id,
      duplicate: false,
      reportCount: moderationCase.reportCount,
    };
  }, TX_OPTIONS);
}

function policyFailure(code: string): never {
  throw new Conflict(code);
}

function eventTypeForAction(action: ModerationCaseCommand["action"]) {
  switch (action) {
    case "START_REVIEW":
      return "REVIEW_STARTED" as const;
    case "HIDE":
    case "QUARANTINE":
      return "TEMPORARILY_RESTRICTED" as const;
    case "RESTORE":
      return "RESTRICTION_RESTORED" as const;
    case "RESOLVE":
      return "RESOLVED" as const;
    case "DISMISS":
      return "DISMISSED" as const;
  }
}

export async function applyModerationCaseAction(
  input: ModerationCaseCommand,
  options: { enabled?: boolean; now?: Date } = {}
): Promise<void> {
  ensureEnabled(options.enabled);
  if (input.actor.role !== "ADMIN") {
    throw new Forbidden("moderation_admin_required");
  }
  const internalReason = normalizedText(input.internalReason, "internalReason");
  const userMessage = input.userMessage?.trim() || null;
  if (userMessage && userMessage.length > MAX_USER_MESSAGE) {
    throw new ValidationError({
      userMessage: "moderation_userMessage_invalid",
    });
  }
  const now = options.now ?? new Date();

  await db.$transaction(async (tx) => {
    const current = await tx.moderationCase.findUnique({
      where: { id: input.caseId },
    });
    if (!current) throw new NotFound("moderation_case_not_found");

    let status: ModerationCaseStatus = current.status;
    let restrictionKind: ModerationRestrictionKind | null =
      current.restrictionKind;
    const data: Prisma.ModerationCaseUpdateInput = {};

    if (input.action === "START_REVIEW") {
      const decision = decideStartReview(current.status);
      if (!decision.allowed) policyFailure(decision.code);
      status = decision.nextStatus;
      data.status = status;
    } else if (input.action === "HIDE" || input.action === "QUARANTINE") {
      const requested = input.action === "HIDE" ? "HIDDEN" : "QUARANTINED";
      const decision = decideTemporaryRestriction({
        status: current.status,
        currentRestriction: current.restrictionKind,
        requested,
      });
      if (!decision.allowed) policyFailure(decision.code);
      restrictionKind = requested;
      data.restrictionKind = requested;
      data.restrictedAt = now;
      data.restrictedById = input.actor.userId;
      data.restrictedReason = internalReason;
    } else if (input.action === "RESTORE") {
      const decision = decideRestoreRestriction({
        status: current.status,
        currentRestriction: current.restrictionKind,
      });
      if (!decision.allowed) policyFailure(decision.code);
      restrictionKind = null;
      data.restrictionKind = null;
      data.restrictedAt = null;
      data.restrictedById = null;
      data.restrictedReason = null;
    } else {
      const outcome = input.action === "RESOLVE" ? "RESOLVED" : "DISMISSED";
      const decision = decideCloseCase({ status: current.status, outcome });
      if (!decision.allowed) policyFailure(decision.code);
      status = decision.nextStatus;
      data.status = status;
      data.activeKey = null;
      data.decisionSummary = internalReason;
      data.userMessage = userMessage;
      data.resolvedAt = now;
      data.resolvedBy = { connect: { id: input.actor.userId } };
      data.appealDeadline =
        outcome === "RESOLVED" ? appealDeadlineFrom(now) : null;
      if (outcome === "DISMISSED") {
        restrictionKind = null;
        data.restrictionKind = null;
        data.restrictedAt = null;
        data.restrictedById = null;
        data.restrictedReason = null;
      }
    }

    await tx.moderationCase.update({
      where: { id: current.id },
      data,
    });
    await tx.moderationCaseEvent.create({
      data: {
        caseId: current.id,
        actorUserId: input.actor.userId,
        type: eventTypeForAction(input.action),
        reason: internalReason,
        userMessage,
        metadata: { status, restrictionKind },
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: input.actor.userId,
        actorRole: input.actor.role,
        action: `MODERATION_${input.action}`,
        targetType: "ModerationCase",
        targetId: current.id,
        targetLabel: current.targetLabel,
        before: {
          status: current.status,
          restrictionKind: current.restrictionKind,
        },
        after: { status, restrictionKind },
        reason: internalReason,
      },
    });
  }, TX_OPTIONS);
}

export async function appealModerationCase(
  input: AppealModerationCaseInput,
  options: { enabled?: boolean; now?: Date } = {}
): Promise<void> {
  ensureEnabled(options.enabled);
  const reason = normalizedText(input.reason, "reason");
  const now = options.now ?? new Date();

  await db.$transaction(async (tx) => {
    const current = await tx.moderationCase.findUnique({
      where: { id: input.caseId },
    });
    if (!current) throw new NotFound("moderation_case_not_found");
    const decision = decideAppeal({
      status: current.status,
      actorUserId: input.actor.userId,
      ownerUserId: current.ownerUserId,
      appealUsed: current.appealUsed,
      appealDeadline: current.appealDeadline,
      now,
    });
    if (!decision.allowed) policyFailure(decision.code);

    const activeKey = `${current.targetType}:${current.targetId}`;
    const activeCase = await tx.moderationCase.findUnique({
      where: { activeKey },
      select: { id: true },
    });
    if (activeCase && activeCase.id !== current.id) {
      policyFailure("moderation_appeal_conflicts_with_active_case");
    }
    await tx.moderationCase.update({
      where: { id: current.id },
      data: {
        activeKey,
        status: decision.nextStatus,
        appealUsed: true,
      },
    });
    await tx.moderationCaseEvent.create({
      data: {
        caseId: current.id,
        actorUserId: input.actor.userId,
        type: "APPEAL_SUBMITTED",
        reason,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: input.actor.userId,
        actorRole: input.actor.role,
        action: "MODERATION_APPEAL_SUBMITTED",
        targetType: "ModerationCase",
        targetId: current.id,
        targetLabel: current.targetLabel,
        before: { status: current.status },
        after: { status: decision.nextStatus },
        reason,
      },
    });
  }, TX_OPTIONS);
}
