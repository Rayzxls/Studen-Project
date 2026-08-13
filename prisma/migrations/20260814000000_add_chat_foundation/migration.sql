-- Persistent classroom Chat foundation (ADR-0049, ADR-0050).
--
-- Additive only. Existing course, identity, learning and notification rows are
-- untouched. Application reads and writes remain fail-closed behind
-- CHAT_ENABLED / CHAT_MUTATIONS_ENABLED until isolated-QA acceptance.

ALTER TYPE "ModerationTargetType" ADD VALUE IF NOT EXISTS 'CHAT_MESSAGE';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'CHAT_MESSAGE';
ALTER TYPE "NotifEntityType" ADD VALUE IF NOT EXISTS 'CHAT_CONVERSATION';

CREATE TYPE "ChatConversationKind" AS ENUM ('COURSE_CHANNEL', 'DIRECT_MESSAGE');
CREATE TYPE "ChatMessageDeletionReason" AS ENUM ('RETENTION', 'ACCOUNT_ANONYMIZED');

ALTER TABLE "WebPushSubscription"
ADD COLUMN "messagePreviewEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "ChatConversation" (
    "id" TEXT NOT NULL,
    "kind" "ChatConversationKind" NOT NULL,
    "courseOfferingId" TEXT,
    "directKey" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3),

    CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ChatConversation_shape_check" CHECK (
      ("kind" = 'COURSE_CHANNEL' AND "courseOfferingId" IS NOT NULL AND "directKey" IS NULL)
      OR
      ("kind" = 'DIRECT_MESSAGE' AND "courseOfferingId" IS NULL AND "directKey" IS NOT NULL)
    )
);

CREATE TABLE "ChatConversationMember" (
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatConversationMember_pkey" PRIMARY KEY ("conversationId", "userId")
);

CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" VARCHAR(4000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletionReason" "ChatMessageDeletionReason",

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ChatMessage_content_state_check" CHECK (
      ("body" IS NOT NULL AND "deletedAt" IS NULL AND "deletionReason" IS NULL)
      OR
      ("body" IS NULL AND "deletedAt" IS NOT NULL AND "deletionReason" IS NOT NULL)
    )
);

CREATE TABLE "ChatBlock" (
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatBlock_pkey" PRIMARY KEY ("blockerId", "blockedId"),
    CONSTRAINT "ChatBlock_distinct_users_check" CHECK ("blockerId" <> "blockedId")
);

CREATE UNIQUE INDEX "ChatConversation_courseOfferingId_key"
ON "ChatConversation"("courseOfferingId");
CREATE UNIQUE INDEX "ChatConversation_directKey_key"
ON "ChatConversation"("directKey");
CREATE INDEX "ChatConversation_kind_lastMessageAt_idx"
ON "ChatConversation"("kind", "lastMessageAt" DESC);
CREATE INDEX "ChatConversation_createdById_createdAt_idx"
ON "ChatConversation"("createdById", "createdAt");
CREATE INDEX "ChatConversationMember_userId_conversationId_idx"
ON "ChatConversationMember"("userId", "conversationId");
CREATE INDEX "ChatMessage_conversationId_createdAt_idx"
ON "ChatMessage"("conversationId", "createdAt" DESC);
CREATE INDEX "ChatMessage_authorId_createdAt_idx"
ON "ChatMessage"("authorId", "createdAt");
CREATE INDEX "ChatMessage_expiresAt_deletedAt_idx"
ON "ChatMessage"("expiresAt", "deletedAt");
CREATE INDEX "ChatBlock_blockedId_blockerId_idx"
ON "ChatBlock"("blockedId", "blockerId");

ALTER TABLE "ChatConversation"
ADD CONSTRAINT "ChatConversation_courseOfferingId_fkey"
FOREIGN KEY ("courseOfferingId") REFERENCES "CourseOffering"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatConversation"
ADD CONSTRAINT "ChatConversation_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ChatConversationMember"
ADD CONSTRAINT "ChatConversationMember_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatConversationMember"
ADD CONSTRAINT "ChatConversationMember_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatMessage"
ADD CONSTRAINT "ChatMessage_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatMessage"
ADD CONSTRAINT "ChatMessage_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChatBlock"
ADD CONSTRAINT "ChatBlock_blockerId_fkey"
FOREIGN KEY ("blockerId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatBlock"
ADD CONSTRAINT "ChatBlock_blockedId_fkey"
FOREIGN KEY ("blockedId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
