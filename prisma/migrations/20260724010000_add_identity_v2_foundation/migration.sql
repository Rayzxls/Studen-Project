-- Additive Identity V2 foundation.
-- Legacy Credentials, Student Number, Class, Term, and lifecycle columns remain
-- available until the isolated QA cutover proves all replacement paths.

ALTER TYPE "AccountStatus" ADD VALUE 'DELETION_PENDING';

CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE');
CREATE TYPE "TeacherInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');
CREATE TYPE "ConsentDocument" AS ENUM ('TERMS_OF_USE', 'PRIVACY_NOTICE');
CREATE TYPE "IdentityTokenPurpose" AS ENUM ('PASSWORD_RECOVERY', 'EMAIL_CHANGE');

ALTER TABLE "User"
ADD COLUMN "email" TEXT,
ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT,
ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN "deletionScheduledFor" TIMESTAMP(3),
ADD COLUMN "anonymizedAt" TIMESTAMP(3);

ALTER TABLE "UserSession"
ADD COLUMN "reauthenticatedAt" TIMESTAMP(3),
ADD COLUMN "revokedReason" TEXT;

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_deletionScheduledFor_idx"
ON "User"("deletionScheduledFor");

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

CREATE UNIQUE INDEX "AuthIdentity_provider_providerAccountId_key"
ON "AuthIdentity"("provider", "providerAccountId");
CREATE UNIQUE INDEX "AuthIdentity_userId_provider_key"
ON "AuthIdentity"("userId", "provider");
CREATE INDEX "AuthIdentity_userId_idx" ON "AuthIdentity"("userId");

CREATE UNIQUE INDEX "TeacherInvite_tokenHash_key"
ON "TeacherInvite"("tokenHash");
CREATE UNIQUE INDEX "TeacherInvite_acceptedByUserId_key"
ON "TeacherInvite"("acceptedByUserId");
CREATE INDEX "TeacherInvite_email_status_idx"
ON "TeacherInvite"("email", "status");
CREATE INDEX "TeacherInvite_expiresAt_status_idx"
ON "TeacherInvite"("expiresAt", "status");
CREATE INDEX "TeacherInvite_createdByUserId_createdAt_idx"
ON "TeacherInvite"("createdByUserId", "createdAt");
CREATE INDEX "TeacherInvite_acceptedByUserId_idx"
ON "TeacherInvite"("acceptedByUserId");

CREATE UNIQUE INDEX "ConsentAcceptance_userId_document_version_key"
ON "ConsentAcceptance"("userId", "document", "version");
CREATE INDEX "ConsentAcceptance_userId_acceptedAt_idx"
ON "ConsentAcceptance"("userId", "acceptedAt");

CREATE UNIQUE INDEX "IdentityToken_tokenHash_key"
ON "IdentityToken"("tokenHash");
CREATE INDEX "IdentityToken_userId_purpose_createdAt_idx"
ON "IdentityToken"("userId", "purpose", "createdAt");
CREATE INDEX "IdentityToken_expiresAt_idx"
ON "IdentityToken"("expiresAt");

CREATE INDEX "RealNameHistory_userId_createdAt_idx"
ON "RealNameHistory"("userId", "createdAt");
CREATE INDEX "RealNameHistory_changedByUserId_createdAt_idx"
ON "RealNameHistory"("changedByUserId", "createdAt");
CREATE INDEX "RealNameHistory_teacherContinuityUntil_idx"
ON "RealNameHistory"("teacherContinuityUntil");
CREATE INDEX "RealNameHistory_studentContinuityUntil_idx"
ON "RealNameHistory"("studentContinuityUntil");

ALTER TABLE "AuthIdentity"
ADD CONSTRAINT "AuthIdentity_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeacherInvite"
ADD CONSTRAINT "TeacherInvite_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeacherInvite"
ADD CONSTRAINT "TeacherInvite_acceptedByUserId_fkey"
FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeacherInvite"
ADD CONSTRAINT "TeacherInvite_revokedByUserId_fkey"
FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ConsentAcceptance"
ADD CONSTRAINT "ConsentAcceptance_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IdentityToken"
ADD CONSTRAINT "IdentityToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RealNameHistory"
ADD CONSTRAINT "RealNameHistory_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RealNameHistory"
ADD CONSTRAINT "RealNameHistory_changedByUserId_fkey"
FOREIGN KEY ("changedByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
