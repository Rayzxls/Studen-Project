-- Telling a class its online room is open (ADR-0053).
--
-- Two enum values. Additive and non-breaking: nothing reads them until the
-- code that writes them ships, and existing rows are untouched.
--
-- ALTER TYPE ... ADD VALUE is not transactional on PostgreSQL, so these are
-- two standalone statements. Both are idempotent-safe to re-run only via
-- IF NOT EXISTS, which is why it is spelled out rather than left implicit.

ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'MEETING_ROOM_OPENED';

ALTER TYPE "NotifEntityType" ADD VALUE IF NOT EXISTS 'SESSION';
