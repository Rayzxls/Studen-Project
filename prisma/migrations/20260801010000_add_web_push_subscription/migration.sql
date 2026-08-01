-- Web Push subscriptions (ADR-0047). One row per browser, several per person.
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

-- The endpoint is what the push service issues and what identifies the
-- subscription to it, so it is the natural key: re-subscribing the same browser
-- updates the row rather than adding a second one.
CREATE UNIQUE INDEX "WebPushSubscription_endpoint_key"
  ON "WebPushSubscription" ("endpoint");
CREATE INDEX "WebPushSubscription_userId_idx"
  ON "WebPushSubscription" ("userId");

-- Deleting an account takes its subscriptions with it.
ALTER TABLE "WebPushSubscription"
  ADD CONSTRAINT "WebPushSubscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
