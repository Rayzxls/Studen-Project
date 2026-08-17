-- ADR-0056: Course rewards derive from the canonical published Score Total.
-- Additive only: the legacy RewardLedgerEntry table remains untouched.

CREATE TYPE "CourseRewardClaimStatus" AS ENUM (
  'PENDING',
  'FULFILLED',
  'REJECTED',
  'SUPERSEDED'
);

CREATE TABLE "CourseRewardTier" (
  "id" TEXT NOT NULL,
  "courseOfferingId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "fulfillmentInstructions" TEXT,
  "requiredScore" INTEGER NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CourseRewardTier_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CourseRewardTier_requiredScore_range" CHECK ("requiredScore" BETWEEN 0 AND 100),
  CONSTRAINT "CourseRewardTier_version_positive" CHECK ("version" > 0),
  CONSTRAINT "CourseRewardTier_title_not_blank" CHECK (length(btrim("title")) > 0)
);

CREATE TABLE "CourseRewardTierRevision" (
  "id" TEXT NOT NULL,
  "tierId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "fulfillmentInstructions" TEXT,
  "requiredScore" INTEGER NOT NULL,
  "archivedAt" TIMESTAMP(3),
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CourseRewardTierRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CourseRewardTierRevision_requiredScore_range" CHECK ("requiredScore" BETWEEN 0 AND 100),
  CONSTRAINT "CourseRewardTierRevision_version_positive" CHECK ("version" > 0),
  CONSTRAINT "CourseRewardTierRevision_title_not_blank" CHECK (length(btrim("title")) > 0)
);

CREATE TABLE "CourseRewardClaim" (
  "id" TEXT NOT NULL,
  "tierId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "status" "CourseRewardClaimStatus" NOT NULL DEFAULT 'PENDING',
  "snapshotTierTitle" TEXT NOT NULL,
  "snapshotTierDescription" TEXT,
  "snapshotTierFulfillmentInstructions" TEXT,
  "snapshotTierRequiredScore" INTEGER NOT NULL,
  "snapshotTierVersion" INTEGER NOT NULL,
  "snapshotScorePercent" DOUBLE PRECISION NOT NULL,
  "snapshotEarnedScore" INTEGER NOT NULL,
  "snapshotPublishedFullScore" INTEGER NOT NULL,
  "requestedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "resolvedByUserId" TEXT,
  "resolutionReason" TEXT,
  "supersededByClaimId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CourseRewardClaim_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CourseRewardClaim_attempt_positive" CHECK ("attempt" > 0),
  CONSTRAINT "CourseRewardClaim_tierScore_range" CHECK ("snapshotTierRequiredScore" BETWEEN 0 AND 100),
  CONSTRAINT "CourseRewardClaim_tierVersion_positive" CHECK ("snapshotTierVersion" > 0),
  CONSTRAINT "CourseRewardClaim_scorePercent_range" CHECK ("snapshotScorePercent" BETWEEN 0 AND 100),
  CONSTRAINT "CourseRewardClaim_score_shape" CHECK (
    "snapshotEarnedScore" >= 0
    AND "snapshotPublishedFullScore" > 0
    AND "snapshotEarnedScore" <= "snapshotPublishedFullScore"
  ),
  CONSTRAINT "CourseRewardClaim_status_shape" CHECK (
    (
      "status" = 'PENDING'
      AND "requestedAt" IS NOT NULL
      AND "resolvedAt" IS NULL
      AND "resolvedByUserId" IS NULL
      AND "resolutionReason" IS NULL
      AND "supersededByClaimId" IS NULL
    )
    OR (
      "status" = 'FULFILLED'
      AND "requestedAt" IS NOT NULL
      AND "resolvedAt" IS NOT NULL
      AND "resolvedByUserId" IS NOT NULL
      AND "supersededByClaimId" IS NULL
    )
    OR (
      "status" = 'REJECTED'
      AND "requestedAt" IS NOT NULL
      AND "resolvedAt" IS NOT NULL
      AND "resolvedByUserId" IS NOT NULL
      AND "resolutionReason" IS NOT NULL
      AND length(btrim("resolutionReason")) >= 5
      AND "supersededByClaimId" IS NULL
    )
    OR (
      "status" = 'SUPERSEDED'
      AND "requestedAt" IS NULL
      AND "resolvedAt" IS NOT NULL
      AND "resolvedByUserId" IS NULL
      AND "resolutionReason" IS NULL
      AND "supersededByClaimId" IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX "CourseRewardTier_courseOfferingId_requiredScore_key"
  ON "CourseRewardTier"("courseOfferingId", "requiredScore");
CREATE INDEX "CourseRewardTier_courseOfferingId_archivedAt_requiredScore_idx"
  ON "CourseRewardTier"("courseOfferingId", "archivedAt", "requiredScore");
CREATE UNIQUE INDEX "CourseRewardTierRevision_tierId_version_key"
  ON "CourseRewardTierRevision"("tierId", "version");
CREATE INDEX "CourseRewardTierRevision_actorUserId_createdAt_idx"
  ON "CourseRewardTierRevision"("actorUserId", "createdAt");
CREATE UNIQUE INDEX "CourseRewardClaim_tierId_enrollmentId_attempt_key"
  ON "CourseRewardClaim"("tierId", "enrollmentId", "attempt");
CREATE UNIQUE INDEX "CourseRewardClaim_one_pending_per_enrollment"
  ON "CourseRewardClaim"("enrollmentId") WHERE "status" = 'PENDING';
CREATE INDEX "CourseRewardClaim_enrollmentId_status_createdAt_idx"
  ON "CourseRewardClaim"("enrollmentId", "status", "createdAt" DESC);
CREATE INDEX "CourseRewardClaim_tierId_status_createdAt_idx"
  ON "CourseRewardClaim"("tierId", "status", "createdAt" DESC);
CREATE INDEX "CourseRewardClaim_resolvedByUserId_resolvedAt_idx"
  ON "CourseRewardClaim"("resolvedByUserId", "resolvedAt");
CREATE INDEX "CourseRewardClaim_supersededByClaimId_idx"
  ON "CourseRewardClaim"("supersededByClaimId");

ALTER TABLE "CourseRewardTier"
  ADD CONSTRAINT "CourseRewardTier_courseOfferingId_fkey"
  FOREIGN KEY ("courseOfferingId") REFERENCES "CourseOffering"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseRewardTierRevision"
  ADD CONSTRAINT "CourseRewardTierRevision_tierId_fkey"
  FOREIGN KEY ("tierId") REFERENCES "CourseRewardTier"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseRewardTierRevision"
  ADD CONSTRAINT "CourseRewardTierRevision_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CourseRewardClaim"
  ADD CONSTRAINT "CourseRewardClaim_tierId_fkey"
  FOREIGN KEY ("tierId") REFERENCES "CourseRewardTier"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseRewardClaim"
  ADD CONSTRAINT "CourseRewardClaim_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseRewardClaim"
  ADD CONSTRAINT "CourseRewardClaim_resolvedByUserId_fkey"
  FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseRewardClaim"
  ADD CONSTRAINT "CourseRewardClaim_supersededByClaimId_fkey"
  FOREIGN KEY ("supersededByClaimId") REFERENCES "CourseRewardClaim"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
