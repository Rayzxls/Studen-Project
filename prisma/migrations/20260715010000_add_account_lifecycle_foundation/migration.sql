-- Additive lifecycle foundation. Legacy columns remain during the rollout.
CREATE TYPE "AccountStatus" AS ENUM (
  'ACTIVE',
  'SUSPENDED',
  'TERMINATED',
  'ANONYMIZED'
);

ALTER TABLE "User"
ADD COLUMN "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';

UPDATE "User" AS target
SET "accountStatus" = CASE
  WHEN EXISTS (
    SELECT 1
    FROM "Student" AS student
    WHERE student."userId" = target."id"
      AND student."anonymized" = TRUE
  ) THEN 'ANONYMIZED'::"AccountStatus"
  WHEN target."deletedAt" IS NOT NULL THEN 'TERMINATED'::"AccountStatus"
  WHEN target."isActive" = FALSE THEN 'SUSPENDED'::"AccountStatus"
  ELSE 'ACTIVE'::"AccountStatus"
END;

CREATE TABLE "AccountLifecycleEvent" (
  "id" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "fromStatus" "AccountStatus" NOT NULL,
  "toStatus" "AccountStatus" NOT NULL,
  "reason" TEXT NOT NULL,
  "userMessage" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AccountLifecycleEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "User_accountStatus_idx" ON "User"("accountStatus");
CREATE INDEX "AccountLifecycleEvent_targetUserId_createdAt_idx"
ON "AccountLifecycleEvent"("targetUserId", "createdAt");
CREATE INDEX "AccountLifecycleEvent_actorUserId_createdAt_idx"
ON "AccountLifecycleEvent"("actorUserId", "createdAt");

ALTER TABLE "AccountLifecycleEvent"
ADD CONSTRAINT "AccountLifecycleEvent_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AccountLifecycleEvent"
ADD CONSTRAINT "AccountLifecycleEvent_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
