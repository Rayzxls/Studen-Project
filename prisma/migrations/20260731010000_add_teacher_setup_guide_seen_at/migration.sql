-- First-course setup walkthrough: remember per teacher that it has been seen.
-- Additive and nullable, so every existing teacher is treated as "not shown
-- yet" and no existing row is rewritten.
ALTER TABLE "Teacher"
  ADD COLUMN "setupGuideSeenAt" TIMESTAMP(3);
