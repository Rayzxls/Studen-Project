-- D0.1: Teacher-owned free-text course metadata.
-- Existing Class/Term/gradeLevel/creditHours data remains intact.
ALTER TABLE "CourseOffering"
  ADD COLUMN "learnerGroupLabel" TEXT,
  ADD COLUMN "academicPeriodLabel" TEXT,
  ALTER COLUMN "classId" DROP NOT NULL,
  ALTER COLUMN "termId" DROP NOT NULL,
  ALTER COLUMN "gradeLevel" DROP NOT NULL,
  ALTER COLUMN "creditHours" DROP NOT NULL;

-- Copy legacy display values into the new CourseOffering-owned fields.
-- Relations remain available as a compatibility fallback during rollout.
UPDATE "CourseOffering" AS course
SET "learnerGroupLabel" = legacy_class."name"
FROM "Class" AS legacy_class
WHERE course."classId" = legacy_class."id"
  AND course."learnerGroupLabel" IS NULL;

UPDATE "CourseOffering" AS course
SET "academicPeriodLabel" = legacy_term."name"
FROM "Term" AS legacy_term
WHERE course."termId" = legacy_term."id"
  AND course."academicPeriodLabel" IS NULL;
