-- CANDIDATE ONLY — do not move this file into prisma/migrations until the
-- adoption runbook has been approved and existing migration bookkeeping has
-- been backed up and reconciled. Generated from prisma/schema.prisma with
-- Prisma 6.19.3 on 2026-08-02, then extended with the raw SQL invariant below.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TEACHER', 'STUDENT');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETION_PENDING', 'TERMINATED', 'ANONYMIZED');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE');

-- CreateEnum
CREATE TYPE "TeacherInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ConsentDocument" AS ENUM ('TERMS_OF_USE', 'PRIVACY_NOTICE');

-- CreateEnum
CREATE TYPE "IdentityTokenPurpose" AS ENUM ('PASSWORD_RECOVERY', 'EMAIL_CHANGE');

-- CreateEnum
CREATE TYPE "ThemeMode" AS ENUM ('SYSTEM', 'LIGHT', 'DARK', 'CREAM');

-- CreateEnum
CREATE TYPE "ModerationTargetType" AS ENUM ('COMMENT', 'ANNOUNCEMENT', 'MATERIAL', 'ASSIGNMENT', 'QUIZ', 'QUIZ_QUESTION', 'FILE_ATTACHMENT', 'PROFILE_IMAGE');

-- CreateEnum
CREATE TYPE "ModerationCaseStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED', 'APPEALED');

-- CreateEnum
CREATE TYPE "ModerationReportCategory" AS ENUM ('HARASSMENT', 'INAPPROPRIATE_CONTENT', 'PRIVACY', 'COPYRIGHT', 'SPAM', 'OTHER');

-- CreateEnum
CREATE TYPE "ModerationRestrictionKind" AS ENUM ('HIDDEN', 'QUARANTINED');

-- CreateEnum
CREATE TYPE "ModerationCaseEventType" AS ENUM ('REPORT_ADDED', 'REVIEW_STARTED', 'TEMPORARILY_RESTRICTED', 'RESTRICTION_RESTORED', 'RESOLVED', 'DISMISSED', 'APPEAL_SUBMITTED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'EXCUSED', 'ABSENT');

-- CreateEnum
CREATE TYPE "ScoreItemSource" AS ENUM ('MANUAL', 'ASSIGNMENT_LINKED', 'QUIZ_LINKED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('NOT_SUBMITTED', 'DRAFT', 'SUBMITTED', 'LATE_SUBMITTED', 'RETURNED', 'GRADED');

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

-- CreateEnum
CREATE TYPE "FileOwnerType" AS ENUM ('ASSIGNMENT', 'MATERIAL', 'ANNOUNCEMENT', 'QUIZ', 'QUIZ_QUESTION', 'QUIZ_OPTION', 'SUBMISSION', 'COMMENT', 'PROFILE_IMAGE');

-- CreateEnum
CREATE TYPE "CommentScope" AS ENUM ('CLASS_WIDE', 'PRIVATE');

-- CreateEnum
CREATE TYPE "CommentOwnerType" AS ENUM ('ASSIGNMENT', 'MATERIAL', 'ANNOUNCEMENT', 'SUBMISSION');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('SCORE_ITEM_PUBLISHED', 'ASSIGNMENT_POSTED', 'MATERIAL_POSTED', 'ANNOUNCEMENT_POSTED', 'SCORE_ENTRY_EDITED', 'SUBMISSION_GRADED', 'SUBMISSION_RETURNED', 'COMMENT_REPLIED', 'CLASS_CODE_JOINED', 'QUIZ_REOPENED', 'QUIZ_EXCEPTION_GRANTED');

-- CreateEnum
CREATE TYPE "NotifEntityType" AS ENUM ('SCORE_ITEM', 'ASSIGNMENT', 'MATERIAL', 'ANNOUNCEMENT', 'SUBMISSION', 'COMMENT', 'ENROLLMENT', 'QUIZ');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "identifier" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "email" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "firstName" TEXT,
    "lastName" TEXT,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "consentedAt" TIMESTAMP(3),
    "consentVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletionRequestedAt" TIMESTAMP(3),
    "deletionScheduledFor" TIMESTAMP(3),
    "anonymizedAt" TIMESTAMP(3),
    "profileImageId" TEXT,
    "themeMode" "ThemeMode" NOT NULL DEFAULT 'SYSTEM',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "providerEmail" TEXT,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherInvite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "TeacherInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "revokeReason" TEXT,

    CONSTRAINT "TeacherInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "document" "ConsentDocument" NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "ConsentAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "IdentityTokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RealNameHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "previousFirstName" TEXT NOT NULL,
    "previousLastName" TEXT NOT NULL,
    "nextFirstName" TEXT NOT NULL,
    "nextLastName" TEXT NOT NULL,
    "teacherContinuityUntil" TIMESTAMP(3),
    "studentContinuityUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RealNameHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "ModerationReport" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "category" "ModerationReportCategory" NOT NULL,
    "details" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "Admin" (
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "WebPushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "WebPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuideTourCompletion" (
    "userId" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuideTourCompletion_pkey" PRIMARY KEY ("userId","tourId")
);

-- CreateTable
CREATE TABLE "Teacher" (
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Student" (
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "anonymized" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reauthenticatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "actorRole" "Role",
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "targetLabel" TEXT,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseOffering" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subjectCode" TEXT,
    "learnerGroupLabel" TEXT,
    "academicPeriodLabel" TEXT,
    "creditHours" DOUBLE PRECISION,
    "classCode" TEXT NOT NULL,
    "codeActive" BOOLEAN NOT NULL DEFAULT true,
    "codeExpiresAt" TIMESTAMP(3),
    "gradeRulesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "archivedById" TEXT,
    "archivedReason" TEXT,

    CONSTRAINT "CourseOffering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseOfferingId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "removedById" TEXT,
    "removedReason" TEXT,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableSlot" (
    "id" TEXT NOT NULL,
    "courseOfferingId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimetableSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "courseOfferingId" TEXT NOT NULL,
    "timetableSlotId" TEXT,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelledReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "note" TEXT,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "markedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreItem" (
    "id" TEXT NOT NULL,
    "courseOfferingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullScore" INTEGER NOT NULL,
    "source" "ScoreItemSource" NOT NULL DEFAULT 'MANUAL',
    "position" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoreItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreEntry" (
    "id" TEXT NOT NULL,
    "scoreItemId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "note" TEXT,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "markedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ScoreEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "courseOfferingId" TEXT NOT NULL,
    "lessonId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "linkUrls" JSONB NOT NULL DEFAULT '[]',
    "fileAttachmentIds" JSONB NOT NULL DEFAULT '[]',
    "dueAt" TIMESTAMP(3),
    "allowText" BOOLEAN NOT NULL DEFAULT true,
    "allowFile" BOOLEAN NOT NULL DEFAULT true,
    "allowLink" BOOLEAN NOT NULL DEFAULT false,
    "submissionClosed" BOOLEAN NOT NULL DEFAULT false,
    "autoCloseAtDue" BOOLEAN NOT NULL DEFAULT false,
    "isScored" BOOLEAN NOT NULL DEFAULT false,
    "scoreItemId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionVersion" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "textContent" TEXT,
    "links" JSONB NOT NULL,
    "fileAttachmentIds" JSONB NOT NULL DEFAULT '[]',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isLate" BOOLEAN NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "hiddenFromStudentAt" TIMESTAMP(3),

    CONSTRAINT "SubmissionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAttachment" (
    "id" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "ownerType" "FileOwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "deletedReason" TEXT,

    CONSTRAINT "FileAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "ownerType" "CommentOwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "scope" "CommentScope" NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "deletedReason" TEXT,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "id" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "sourceEntityType" "NotifEntityType" NOT NULL,
    "sourceEntityId" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "courseOfferingId" TEXT,
    "readAt" TIMESTAMP(3),
    "suppressedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "courseOfferingId" TEXT NOT NULL,
    "lessonId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "fileAttachmentIds" JSONB NOT NULL DEFAULT '[]',
    "linkUrls" JSONB NOT NULL DEFAULT '[]',
    "postedById" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "deletedReason" TEXT,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "courseOfferingId" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "fileAttachmentIds" JSONB NOT NULL DEFAULT '[]',
    "linkUrls" JSONB NOT NULL DEFAULT '[]',
    "postedById" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "deletedReason" TEXT,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_identifier_key" ON "User"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_accountStatus_idx" ON "User"("accountStatus");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE INDEX "User_deletionScheduledFor_idx" ON "User"("deletionScheduledFor");

-- CreateIndex
CREATE INDEX "AuthIdentity_userId_idx" ON "AuthIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthIdentity_provider_providerAccountId_key" ON "AuthIdentity"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthIdentity_userId_provider_key" ON "AuthIdentity"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherInvite_tokenHash_key" ON "TeacherInvite"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherInvite_acceptedByUserId_key" ON "TeacherInvite"("acceptedByUserId");

-- CreateIndex
CREATE INDEX "TeacherInvite_email_status_idx" ON "TeacherInvite"("email", "status");

-- CreateIndex
CREATE INDEX "TeacherInvite_expiresAt_status_idx" ON "TeacherInvite"("expiresAt", "status");

-- CreateIndex
CREATE INDEX "TeacherInvite_createdByUserId_createdAt_idx" ON "TeacherInvite"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "TeacherInvite_acceptedByUserId_idx" ON "TeacherInvite"("acceptedByUserId");

-- CreateIndex
CREATE INDEX "ConsentAcceptance_userId_acceptedAt_idx" ON "ConsentAcceptance"("userId", "acceptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentAcceptance_userId_document_version_key" ON "ConsentAcceptance"("userId", "document", "version");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityToken_tokenHash_key" ON "IdentityToken"("tokenHash");

-- CreateIndex
CREATE INDEX "IdentityToken_userId_purpose_createdAt_idx" ON "IdentityToken"("userId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "IdentityToken_expiresAt_idx" ON "IdentityToken"("expiresAt");

-- CreateIndex
CREATE INDEX "RealNameHistory_userId_createdAt_idx" ON "RealNameHistory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RealNameHistory_changedByUserId_createdAt_idx" ON "RealNameHistory"("changedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "RealNameHistory_teacherContinuityUntil_idx" ON "RealNameHistory"("teacherContinuityUntil");

-- CreateIndex
CREATE INDEX "RealNameHistory_studentContinuityUntil_idx" ON "RealNameHistory"("studentContinuityUntil");

-- CreateIndex
CREATE INDEX "AccountLifecycleEvent_targetUserId_createdAt_idx" ON "AccountLifecycleEvent"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AccountLifecycleEvent_actorUserId_createdAt_idx" ON "AccountLifecycleEvent"("actorUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationCase_activeKey_key" ON "ModerationCase"("activeKey");

-- CreateIndex
CREATE INDEX "ModerationCase_status_priority_createdAt_idx" ON "ModerationCase"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationCase_targetType_targetId_idx" ON "ModerationCase"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ModerationCase_courseOfferingId_status_idx" ON "ModerationCase"("courseOfferingId", "status");

-- CreateIndex
CREATE INDEX "ModerationCase_ownerUserId_status_idx" ON "ModerationCase"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "ModerationReport_reporterId_createdAt_idx" ON "ModerationReport"("reporterId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationReport_caseId_reporterId_key" ON "ModerationReport"("caseId", "reporterId");

-- CreateIndex
CREATE INDEX "ModerationCaseEvent_caseId_createdAt_idx" ON "ModerationCaseEvent"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationCaseEvent_actorUserId_createdAt_idx" ON "ModerationCaseEvent"("actorUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebPushSubscription_endpoint_key" ON "WebPushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "WebPushSubscription_userId_idx" ON "WebPushSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_email_key" ON "Teacher"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_tokenHash_key" ON "UserSession"("tokenHash");

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");

-- CreateIndex
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_timestamp_idx" ON "AuditLog"("actorId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_action_timestamp_idx" ON "AuditLog"("action", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseOffering_classCode_key" ON "CourseOffering"("classCode");

-- CreateIndex
CREATE INDEX "CourseOffering_classCode_idx" ON "CourseOffering"("classCode");

-- CreateIndex
CREATE INDEX "CourseOffering_teacherId_idx" ON "CourseOffering"("teacherId");

-- CreateIndex
CREATE INDEX "CourseOffering_archivedAt_idx" ON "CourseOffering"("archivedAt");

-- CreateIndex
CREATE INDEX "Enrollment_courseOfferingId_idx" ON "Enrollment"("courseOfferingId");

-- CreateIndex
CREATE INDEX "Enrollment_removedAt_idx" ON "Enrollment"("removedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_studentId_courseOfferingId_key" ON "Enrollment"("studentId", "courseOfferingId");

-- CreateIndex
CREATE INDEX "TimetableSlot_courseOfferingId_idx" ON "TimetableSlot"("courseOfferingId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableSlot_courseOfferingId_dayOfWeek_startTime_key" ON "TimetableSlot"("courseOfferingId", "dayOfWeek", "startTime");

-- CreateIndex
CREATE INDEX "Session_courseOfferingId_scheduledStart_idx" ON "Session"("courseOfferingId", "scheduledStart");

-- CreateIndex
CREATE INDEX "Session_timetableSlotId_idx" ON "Session"("timetableSlotId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_courseOfferingId_scheduledStart_key" ON "Session"("courseOfferingId", "scheduledStart");

-- CreateIndex
CREATE INDEX "AttendanceRecord_enrollmentId_idx" ON "AttendanceRecord"("enrollmentId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_sessionId_idx" ON "AttendanceRecord"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_sessionId_enrollmentId_key" ON "AttendanceRecord"("sessionId", "enrollmentId");

-- CreateIndex
CREATE INDEX "ScoreItem_courseOfferingId_position_idx" ON "ScoreItem"("courseOfferingId", "position");

-- CreateIndex
CREATE INDEX "ScoreItem_courseOfferingId_publishedAt_idx" ON "ScoreItem"("courseOfferingId", "publishedAt");

-- CreateIndex
CREATE INDEX "ScoreEntry_enrollmentId_idx" ON "ScoreEntry"("enrollmentId");

-- CreateIndex
CREATE INDEX "ScoreEntry_scoreItemId_idx" ON "ScoreEntry"("scoreItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreEntry_scoreItemId_enrollmentId_key" ON "ScoreEntry"("scoreItemId", "enrollmentId");

-- CreateIndex
CREATE INDEX "Lesson_courseOfferingId_position_idx" ON "Lesson"("courseOfferingId", "position");

-- CreateIndex
CREATE INDEX "Lesson_courseOfferingId_archivedAt_idx" ON "Lesson"("courseOfferingId", "archivedAt");

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

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_scoreItemId_key" ON "Assignment"("scoreItemId");

-- CreateIndex
CREATE INDEX "Assignment_courseOfferingId_createdAt_idx" ON "Assignment"("courseOfferingId", "createdAt");

-- CreateIndex
CREATE INDEX "Assignment_lessonId_createdAt_idx" ON "Assignment"("lessonId", "createdAt");

-- CreateIndex
CREATE INDEX "Assignment_scoreItemId_idx" ON "Assignment"("scoreItemId");

-- CreateIndex
CREATE INDEX "Submission_assignmentId_status_idx" ON "Submission"("assignmentId", "status");

-- CreateIndex
CREATE INDEX "Submission_enrollmentId_idx" ON "Submission"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_assignmentId_enrollmentId_key" ON "Submission"("assignmentId", "enrollmentId");

-- CreateIndex
CREATE INDEX "SubmissionVersion_submissionId_isCurrent_idx" ON "SubmissionVersion"("submissionId", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionVersion_submissionId_versionNumber_key" ON "SubmissionVersion"("submissionId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FileAttachment_r2Key_key" ON "FileAttachment"("r2Key");

-- CreateIndex
CREATE INDEX "FileAttachment_ownerType_ownerId_idx" ON "FileAttachment"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "FileAttachment_uploadedById_idx" ON "FileAttachment"("uploadedById");

-- CreateIndex
CREATE INDEX "Comment_ownerType_ownerId_createdAt_idx" ON "Comment"("ownerType", "ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_authorId_idx" ON "Comment"("authorId");

-- CreateIndex
CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");

-- CreateIndex
CREATE INDEX "Notification_recipientId_readAt_createdAt_idx" ON "Notification"("recipientId", "readAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_recipientId_courseOfferingId_suppressedAt_idx" ON "Notification"("recipientId", "courseOfferingId", "suppressedAt");

-- CreateIndex
CREATE INDEX "Material_courseOfferingId_postedAt_idx" ON "Material"("courseOfferingId", "postedAt" DESC);

-- CreateIndex
CREATE INDEX "Material_lessonId_postedAt_idx" ON "Material"("lessonId", "postedAt" DESC);

-- CreateIndex
CREATE INDEX "Material_deletedAt_idx" ON "Material"("deletedAt");

-- CreateIndex
CREATE INDEX "Announcement_courseOfferingId_postedAt_idx" ON "Announcement"("courseOfferingId", "postedAt" DESC);

-- CreateIndex
CREATE INDEX "Announcement_deletedAt_idx" ON "Announcement"("deletedAt");

-- AddForeignKey
ALTER TABLE "AuthIdentity" ADD CONSTRAINT "AuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherInvite" ADD CONSTRAINT "TeacherInvite_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherInvite" ADD CONSTRAINT "TeacherInvite_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherInvite" ADD CONSTRAINT "TeacherInvite_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentAcceptance" ADD CONSTRAINT "ConsentAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityToken" ADD CONSTRAINT "IdentityToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealNameHistory" ADD CONSTRAINT "RealNameHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealNameHistory" ADD CONSTRAINT "RealNameHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountLifecycleEvent" ADD CONSTRAINT "AccountLifecycleEvent_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountLifecycleEvent" ADD CONSTRAINT "AccountLifecycleEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationReport" ADD CONSTRAINT "ModerationReport_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ModerationCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationReport" ADD CONSTRAINT "ModerationReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationCaseEvent" ADD CONSTRAINT "ModerationCaseEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ModerationCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationCaseEvent" ADD CONSTRAINT "ModerationCaseEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebPushSubscription" ADD CONSTRAINT "WebPushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuideTourCompletion" ADD CONSTRAINT "GuideTourCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOffering" ADD CONSTRAINT "CourseOffering_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "CourseOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "CourseOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "CourseOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_timetableSlotId_fkey" FOREIGN KEY ("timetableSlotId") REFERENCES "TimetableSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreItem" ADD CONSTRAINT "ScoreItem_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "CourseOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEntry" ADD CONSTRAINT "ScoreEntry_scoreItemId_fkey" FOREIGN KEY ("scoreItemId") REFERENCES "ScoreItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEntry" ADD CONSTRAINT "ScoreEntry_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "CourseOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "CourseOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_scoreItemId_fkey" FOREIGN KEY ("scoreItemId") REFERENCES "ScoreItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionVersion" ADD CONSTRAINT "SubmissionVersion_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "CourseOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "CourseOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma cannot express this partial unique index. Keep it in sync with
-- prisma/raw-sql/0001-notification-partial-unique.sql and ADR-0022 § 3.
CREATE UNIQUE INDEX "notification_post_once"
  ON "Notification" ("recipientId", "kind", "sourceEntityType", "sourceEntityId")
  WHERE "kind" IN (
    'SCORE_ITEM_PUBLISHED',
    'ASSIGNMENT_POSTED',
    'MATERIAL_POSTED',
    'ANNOUNCEMENT_POSTED',
    'SUBMISSION_GRADED',
    'SUBMISSION_RETURNED',
    'CLASS_CODE_JOINED'
  );
