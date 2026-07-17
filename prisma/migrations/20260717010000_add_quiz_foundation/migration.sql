-- CreateEnum
CREATE TYPE "QuizMode" AS ENUM ('PRACTICE', 'SCORED');

-- CreateEnum
CREATE TYPE "QuizStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "QuizQuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_SELECT', 'TRUE_FALSE');

-- CreateEnum
CREATE TYPE "QuizAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED');

-- CreateEnum
CREATE TYPE "QuizSubmissionTrigger" AS ENUM ('MANUAL', 'DEADLINE', 'QUIZ_CLOSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ModerationTargetType" ADD VALUE 'QUIZ';
ALTER TYPE "ModerationTargetType" ADD VALUE 'QUIZ_QUESTION';

-- AlterEnum
ALTER TYPE "ScoreItemSource" ADD VALUE 'QUIZ_LINKED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FileOwnerType" ADD VALUE 'QUIZ';
ALTER TYPE "FileOwnerType" ADD VALUE 'QUIZ_QUESTION';
ALTER TYPE "FileOwnerType" ADD VALUE 'QUIZ_OPTION';

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "courseOfferingId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mode" "QuizMode" NOT NULL,
    "status" "QuizStatus" NOT NULL DEFAULT 'DRAFT',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "timeLimitMinutes" INTEGER,
    "maxAttempts" INTEGER,
    "passThresholdPercent" INTEGER,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
    "shuffleOptions" BOOLEAN NOT NULL DEFAULT false,
    "hideExplanations" BOOLEAN NOT NULL DEFAULT false,
    "fileAttachmentIds" JSONB NOT NULL DEFAULT '[]',
    "scoreItemId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelledReason" TEXT,
    "archivedAt" TIMESTAMP(3),
    "archivedById" TEXT,
    "archivedReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "type" "QuizQuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "explanation" TEXT,
    "points" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "fileAttachmentIds" JSONB NOT NULL DEFAULT '[]',
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "fileAttachmentIds" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "QuizOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "QuizAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveDeadline" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "submissionTrigger" "QuizSubmissionTrigger",
    "snapshotRevision" INTEGER NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "autoScore" INTEGER,
    "finalScore" INTEGER,
    "adjustedAt" TIMESTAMP(3),
    "adjustedById" TEXT,
    "adjustedReason" TEXT,
    "leaseVersion" INTEGER NOT NULL DEFAULT 1,
    "leaseTokenHash" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "writeRevision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerJson" JSONB NOT NULL,
    "isCorrect" BOOLEAN,
    "awardedPoints" INTEGER,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttemptMutation" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "resultRevision" INTEGER NOT NULL,
    "responseJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttemptMutation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizStudentException" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "extendedDeadline" TIMESTAMP(3),
    "extraAttempts" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizStudentException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quiz_scoreItemId_key" ON "Quiz"("scoreItemId");

-- CreateIndex
CREATE INDEX "Quiz_courseOfferingId_status_position_idx" ON "Quiz"("courseOfferingId", "status", "position");

-- CreateIndex
CREATE INDEX "Quiz_lessonId_status_position_idx" ON "Quiz"("lessonId", "status", "position");

-- CreateIndex
CREATE INDEX "Quiz_scoreItemId_idx" ON "Quiz"("scoreItemId");

-- CreateIndex
CREATE INDEX "Quiz_archivedAt_idx" ON "Quiz"("archivedAt");

-- CreateIndex
CREATE INDEX "QuizQuestion_quizId_voidedAt_idx" ON "QuizQuestion"("quizId", "voidedAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuizQuestion_quizId_position_key" ON "QuizQuestion"("quizId", "position");

-- CreateIndex
CREATE INDEX "QuizOption_questionId_idx" ON "QuizOption"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizOption_questionId_position_key" ON "QuizOption"("questionId", "position");

-- CreateIndex
CREATE INDEX "QuizAttempt_quizId_status_idx" ON "QuizAttempt"("quizId", "status");

-- CreateIndex
CREATE INDEX "QuizAttempt_enrollmentId_status_idx" ON "QuizAttempt"("enrollmentId", "status");

-- CreateIndex
CREATE INDEX "QuizAttempt_effectiveDeadline_status_idx" ON "QuizAttempt"("effectiveDeadline", "status");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAttempt_quizId_enrollmentId_attemptNumber_key" ON "QuizAttempt"("quizId", "enrollmentId", "attemptNumber");

-- CreateIndex
CREATE INDEX "QuizAnswer_questionId_idx" ON "QuizAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAnswer_attemptId_questionId_key" ON "QuizAnswer"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "QuizAttemptMutation_attemptId_createdAt_idx" ON "QuizAttemptMutation"("attemptId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAttemptMutation_attemptId_idempotencyKey_key" ON "QuizAttemptMutation"("attemptId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "QuizStudentException_enrollmentId_idx" ON "QuizStudentException"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizStudentException_quizId_enrollmentId_key" ON "QuizStudentException"("quizId", "enrollmentId");

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "CourseOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_scoreItemId_fkey" FOREIGN KEY ("scoreItemId") REFERENCES "ScoreItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizOption" ADD CONSTRAINT "QuizOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttemptMutation" ADD CONSTRAINT "QuizAttemptMutation_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizStudentException" ADD CONSTRAINT "QuizStudentException_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizStudentException" ADD CONSTRAINT "QuizStudentException_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
