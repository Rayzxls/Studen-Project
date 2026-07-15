-- Additive Lesson Workspace foundation. Existing content remains course-wide.
CREATE TABLE "Lesson" (
  "id" TEXT NOT NULL,
  "courseOfferingId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "archivedAt" TIMESTAMP(3),
  "archivedById" TEXT,
  "archivedReason" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Assignment" ADD COLUMN "lessonId" TEXT;
ALTER TABLE "Material" ADD COLUMN "lessonId" TEXT;

CREATE INDEX "Lesson_courseOfferingId_position_idx"
ON "Lesson"("courseOfferingId", "position");
CREATE INDEX "Lesson_courseOfferingId_archivedAt_idx"
ON "Lesson"("courseOfferingId", "archivedAt");
CREATE INDEX "Assignment_lessonId_createdAt_idx"
ON "Assignment"("lessonId", "createdAt");
CREATE INDEX "Material_lessonId_postedAt_idx"
ON "Material"("lessonId", "postedAt" DESC);

ALTER TABLE "Lesson"
ADD CONSTRAINT "Lesson_courseOfferingId_fkey"
FOREIGN KEY ("courseOfferingId") REFERENCES "CourseOffering"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Assignment"
ADD CONSTRAINT "Assignment_lessonId_fkey"
FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Material"
ADD CONSTRAINT "Material_lessonId_fkey"
FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
