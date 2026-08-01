-- Scheduled publishing (ADR-0046).
--
-- `publishAt` null means visible as soon as the row exists, which is what every
-- existing row already means, so nothing is backfilled and no current content
-- changes visibility.
--
-- `notifiedAt` marks that the publish fan-out has run, so the sweep is
-- idempotent and a retry cannot notify a class twice.
ALTER TABLE "Announcement"
  ADD COLUMN "publishAt" TIMESTAMP(3),
  ADD COLUMN "notifiedAt" TIMESTAMP(3);

ALTER TABLE "Material"
  ADD COLUMN "publishAt" TIMESTAMP(3),
  ADD COLUMN "notifiedAt" TIMESTAMP(3);

ALTER TABLE "Assignment"
  ADD COLUMN "publishAt" TIMESTAMP(3),
  ADD COLUMN "notifiedAt" TIMESTAMP(3);

-- The sweep asks each table for "due to publish and not yet notified". A
-- partial index keeps that cheap and, because it only covers scheduled rows,
-- stays small however much content the school accumulates.
CREATE INDEX "Announcement_publishAt_notifiedAt_idx"
  ON "Announcement" ("publishAt") WHERE "publishAt" IS NOT NULL AND "notifiedAt" IS NULL;
CREATE INDEX "Material_publishAt_notifiedAt_idx"
  ON "Material" ("publishAt") WHERE "publishAt" IS NOT NULL AND "notifiedAt" IS NULL;
CREATE INDEX "Assignment_publishAt_notifiedAt_idx"
  ON "Assignment" ("publishAt") WHERE "publishAt" IS NOT NULL AND "notifiedAt" IS NULL;
