-- D1 identity compatibility cleanup only.
-- AcademicYear, Term, Class, gradeLevel, and internal User foreign keys named
-- studentId are intentionally outside this migration.
DROP INDEX IF EXISTS "Student_studentId_key";

ALTER TABLE "Student"
DROP COLUMN "studentId";

ALTER TABLE "User"
DROP COLUMN "mustResetPwd",
DROP COLUMN "displayName";
