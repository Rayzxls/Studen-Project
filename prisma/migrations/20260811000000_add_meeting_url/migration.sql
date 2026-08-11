-- Online classroom links (ADR-0052).
--
-- Purely additive: two nullable text columns, no defaults, no backfill, no
-- constraint on existing rows. Every course and every timetable slot that
-- exists today keeps working with both columns null, which reads as "this
-- period has no online room", the correct state for a class that meets in a
-- physical room.
--
-- The link lives on the course because a teacher's online room is usually the
-- same all term, and on the slot so a course whose lecture and lab meet in
-- different places can say so. It is deliberately absent from "Session":
-- session rows are materialised lazily on the teacher's first action, and a
-- student needs to know where to go before the class is opened.

ALTER TABLE "CourseOffering" ADD COLUMN "meetingUrl" TEXT;

ALTER TABLE "TimetableSlot" ADD COLUMN "meetingUrl" TEXT;
