-- The live online room (ADR-0053).
--
-- Additive. Two nullable columns on an existing table and one new table, so
-- every Session that exists today keeps working with both columns null, which
-- reads as "no online room was ever opened for this period" — the correct
-- state for a class that met in a physical room.
--
-- Opening the room is deliberately separate from opening the Session. A
-- teacher taking attendance for a class in อาคาร 3 opens a Session and never
-- opens a room; an online class does both. Folding them together would make
-- every physical class look like it had an empty online room.
--
-- MeetingPresence is not an attendance table and is not named like one. A row
-- records that someone pressed Join and that their tab has reported in since.
-- ADR-0052's rule stands: only a teacher writes an AttendanceRecord.

ALTER TABLE "Session" ADD COLUMN "roomOpenedAt" TIMESTAMP(3);

ALTER TABLE "Session" ADD COLUMN "roomClosedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MeetingPresence" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "lastActiveAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingPresence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingPresence_sessionId_lastSeenAt_idx" ON "MeetingPresence"("sessionId", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingPresence_sessionId_userId_key" ON "MeetingPresence"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "Session_courseOfferingId_roomOpenedAt_idx" ON "Session"("courseOfferingId", "roomOpenedAt");

-- AddForeignKey
ALTER TABLE "MeetingPresence" ADD CONSTRAINT "MeetingPresence_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingPresence" ADD CONSTRAINT "MeetingPresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
