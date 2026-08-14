-- ADR-0051: immutable Reward ledger with isolated course/system economies.

CREATE TYPE "RewardEconomy" AS ENUM ('COURSE', 'SYSTEM');
CREATE TYPE "RewardLedgerEntryKind" AS ENUM ('AWARD', 'REVERSAL');
CREATE TYPE "RewardAchievementType" AS ENUM (
  'ASSIGNMENT_SUBMITTED',
  'ATTENDANCE_PRESENT',
  'SCORE_THRESHOLD',
  'SYSTEM_QUEST'
);

CREATE TABLE "RewardLedgerEntry" (
  "id" TEXT NOT NULL,
  "economy" "RewardEconomy" NOT NULL,
  "studentId" TEXT NOT NULL,
  "enrollmentId" TEXT,
  "courseOfferingId" TEXT,
  "kind" "RewardLedgerEntryKind" NOT NULL,
  "amount" INTEGER NOT NULL,
  "achievementType" "RewardAchievementType" NOT NULL,
  "achievementId" TEXT NOT NULL,
  "awardKey" TEXT,
  "reversesEntryId" TEXT,
  "actorUserId" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RewardLedgerEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RewardLedgerEntry_amount_nonzero" CHECK ("amount" <> 0),
  CONSTRAINT "RewardLedgerEntry_scope_check" CHECK (
    (
      "economy" = 'COURSE'
      AND "enrollmentId" IS NOT NULL
      AND "courseOfferingId" IS NOT NULL
    )
    OR
    (
      "economy" = 'SYSTEM'
      AND "enrollmentId" IS NULL
      AND "courseOfferingId" IS NULL
    )
  ),
  CONSTRAINT "RewardLedgerEntry_award_shape" CHECK (
    ("kind" = 'AWARD' AND "amount" > 0 AND "awardKey" IS NOT NULL AND "reversesEntryId" IS NULL)
    OR
    ("kind" = 'REVERSAL' AND "awardKey" IS NULL AND "reversesEntryId" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "RewardLedgerEntry_awardKey_key"
  ON "RewardLedgerEntry"("awardKey");
CREATE UNIQUE INDEX "RewardLedgerEntry_reversesEntryId_key"
  ON "RewardLedgerEntry"("reversesEntryId");
CREATE INDEX "RewardLedgerEntry_studentId_economy_createdAt_idx"
  ON "RewardLedgerEntry"("studentId", "economy", "createdAt" DESC);
CREATE INDEX "RewardLedgerEntry_enrollmentId_createdAt_idx"
  ON "RewardLedgerEntry"("enrollmentId", "createdAt" DESC);
CREATE INDEX "RewardLedgerEntry_courseOfferingId_createdAt_idx"
  ON "RewardLedgerEntry"("courseOfferingId", "createdAt" DESC);
CREATE INDEX "RewardLedgerEntry_achievementType_achievementId_idx"
  ON "RewardLedgerEntry"("achievementType", "achievementId");

ALTER TABLE "RewardLedgerEntry"
  ADD CONSTRAINT "RewardLedgerEntry_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("userId")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RewardLedgerEntry"
  ADD CONSTRAINT "RewardLedgerEntry_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RewardLedgerEntry"
  ADD CONSTRAINT "RewardLedgerEntry_courseOfferingId_fkey"
  FOREIGN KEY ("courseOfferingId") REFERENCES "CourseOffering"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RewardLedgerEntry"
  ADD CONSTRAINT "RewardLedgerEntry_reversesEntryId_fkey"
  FOREIGN KEY ("reversesEntryId") REFERENCES "RewardLedgerEntry"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RewardLedgerEntry"
  ADD CONSTRAINT "RewardLedgerEntry_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
