-- Guided walkthroughs are now per role and per surface, so completion is stored
-- per (user, tour) instead of a single flag on Teacher.
CREATE TABLE "GuideTourCompletion" (
  "userId" TEXT NOT NULL,
  "tourId" TEXT NOT NULL,
  "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GuideTourCompletion_pkey" PRIMARY KEY ("userId", "tourId")
);

ALTER TABLE "GuideTourCompletion"
  ADD CONSTRAINT "GuideTourCompletion_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry over anyone who already finished the teacher course walkthrough, so the
-- change does not show it to them again.
INSERT INTO "GuideTourCompletion" ("userId", "tourId", "seenAt")
SELECT "userId", 'teacher-course', "setupGuideSeenAt"
FROM "Teacher"
WHERE "setupGuideSeenAt" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Superseded by the table above. Added earlier the same day and never applied
-- to Production, so this drops no production data.
ALTER TABLE "Teacher" DROP COLUMN "setupGuideSeenAt";
