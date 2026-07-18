-- Quiz lifecycle notifications are repeatable and intentionally remain outside
-- the post-once partial notification index.
ALTER TYPE "NotificationKind" ADD VALUE 'QUIZ_REOPENED';
ALTER TYPE "NotificationKind" ADD VALUE 'QUIZ_EXCEPTION_GRANTED';
ALTER TYPE "NotifEntityType" ADD VALUE 'QUIZ';
