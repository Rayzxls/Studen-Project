-- D0 academic compatibility cleanup only.
-- Teacher-owned free-text course metadata remains the source of truth.
-- Internal User foreign keys such as Enrollment.studentId are out of scope.

ALTER TABLE "Teacher"
DROP CONSTRAINT IF EXISTS "Teacher_homeroomOfId_fkey";

ALTER TABLE "Student"
DROP CONSTRAINT IF EXISTS "Student_classId_fkey";

ALTER TABLE "CourseOffering"
DROP CONSTRAINT IF EXISTS "CourseOffering_classId_fkey",
DROP CONSTRAINT IF EXISTS "CourseOffering_termId_fkey";

DROP INDEX IF EXISTS "Teacher_homeroomOfId_key";
DROP INDEX IF EXISTS "CourseOffering_classId_termId_idx";

ALTER TABLE "Teacher"
DROP COLUMN "homeroomOfId";

ALTER TABLE "Student"
DROP COLUMN "classId";

ALTER TABLE "CourseOffering"
DROP COLUMN "classId",
DROP COLUMN "termId",
DROP COLUMN "gradeLevel";

DROP TABLE "Class";
DROP TABLE "Term";
DROP TABLE "AcademicYear";
