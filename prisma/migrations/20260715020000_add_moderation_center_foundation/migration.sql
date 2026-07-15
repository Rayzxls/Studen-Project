-- Additive Moderation Center foundation. No existing content is changed.
CREATE TYPE "ModerationTargetType" AS ENUM (
  'COMMENT',
  'ANNOUNCEMENT',
  'MATERIAL',
  'ASSIGNMENT',
  'FILE_ATTACHMENT',
  'PROFILE_IMAGE'
);

CREATE TYPE "ModerationCaseStatus" AS ENUM (
  'OPEN',
  'IN_REVIEW',
  'RESOLVED',
  'DISMISSED',
  'APPEALED'
);

CREATE TYPE "ModerationReportCategory" AS ENUM (
  'HARASSMENT',
  'INAPPROPRIATE_CONTENT',
  'PRIVACY',
  'COPYRIGHT',
  'SPAM',
  'OTHER'
);

CREATE TYPE "ModerationRestrictionKind" AS ENUM ('HIDDEN', 'QUARANTINED');

CREATE TYPE "ModerationCaseEventType" AS ENUM (
  'REPORT_ADDED',
  'REVIEW_STARTED',
  'TEMPORARILY_RESTRICTED',
  'RESTRICTION_RESTORED',
  'RESOLVED',
  'DISMISSED',
  'APPEAL_SUBMITTED'
);

CREATE TABLE "ModerationCase" (
  "id" TEXT NOT NULL,
  "activeKey" TEXT,
  "targetType" "ModerationTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "targetLabel" TEXT NOT NULL,
  "targetSnapshot" JSONB NOT NULL,
  "courseOfferingId" TEXT,
  "ownerUserId" TEXT,
  "status" "ModerationCaseStatus" NOT NULL DEFAULT 'OPEN',
  "reportCount" INTEGER NOT NULL DEFAULT 0,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "restrictionKind" "ModerationRestrictionKind",
  "restrictedAt" TIMESTAMP(3),
  "restrictedById" TEXT,
  "restrictedReason" TEXT,
  "decisionSummary" TEXT,
  "userMessage" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "appealDeadline" TIMESTAMP(3),
  "appealUsed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ModerationCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModerationReport" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "category" "ModerationReportCategory" NOT NULL,
  "details" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ModerationReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModerationCaseEvent" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "type" "ModerationCaseEventType" NOT NULL,
  "reason" TEXT,
  "userMessage" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ModerationCaseEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModerationCase_activeKey_key" ON "ModerationCase"("activeKey");
CREATE INDEX "ModerationCase_status_priority_createdAt_idx" ON "ModerationCase"("status", "priority", "createdAt");
CREATE INDEX "ModerationCase_targetType_targetId_idx" ON "ModerationCase"("targetType", "targetId");
CREATE INDEX "ModerationCase_courseOfferingId_status_idx" ON "ModerationCase"("courseOfferingId", "status");
CREATE INDEX "ModerationCase_ownerUserId_status_idx" ON "ModerationCase"("ownerUserId", "status");
CREATE UNIQUE INDEX "ModerationReport_caseId_reporterId_key" ON "ModerationReport"("caseId", "reporterId");
CREATE INDEX "ModerationReport_reporterId_createdAt_idx" ON "ModerationReport"("reporterId", "createdAt");
CREATE INDEX "ModerationCaseEvent_caseId_createdAt_idx" ON "ModerationCaseEvent"("caseId", "createdAt");
CREATE INDEX "ModerationCaseEvent_actorUserId_createdAt_idx" ON "ModerationCaseEvent"("actorUserId", "createdAt");

ALTER TABLE "ModerationCase"
  ADD CONSTRAINT "ModerationCase_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ModerationCase"
  ADD CONSTRAINT "ModerationCase_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ModerationReport"
  ADD CONSTRAINT "ModerationReport_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "ModerationCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ModerationReport"
  ADD CONSTRAINT "ModerationReport_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ModerationCaseEvent"
  ADD CONSTRAINT "ModerationCaseEvent_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "ModerationCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ModerationCaseEvent"
  ADD CONSTRAINT "ModerationCaseEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
