-- ═══════════════════════════════════════════════════════════
-- ADR-0022 § 3 — partial unique index on Notification post-once kinds
--
-- Prisma 6 @@unique does not support WHERE clauses, so this index is
-- created via raw SQL after `prisma db push` brings the Notification
-- table into existence. Re-apply by re-running this file — `IF NOT
-- EXISTS` makes it idempotent.
--
-- Why partial:
--   • Post-once kinds (SCORE_ITEM_PUBLISHED, ASSIGNMENT_POSTED,
--     MATERIAL_POSTED, ANNOUNCEMENT_POSTED, SUBMISSION_GRADED,
--     SUBMISSION_RETURNED, CLASS_CODE_JOINED) — exactly one row per
--     (recipient × source entity); `createMany({skipDuplicates: true})`
--     swallows server-action double-submit safely.
--   • Repeatable kinds (SCORE_ENTRY_EDITED, COMMENT_REPLIED) live
--     OUTSIDE the partial scope — bulk edit ครั้งที่ 2 must fire
--     another row.
--
-- Maintenance: if a kind ever moves between post-once and repeatable
-- semantics, update both this file AND ADR-0022 § 3 in the same commit.
-- ═══════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS "notification_post_once"
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
