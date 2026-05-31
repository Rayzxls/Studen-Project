import { db } from "@/lib/db/client";

/**
 * In-DB rate limiter (Phase 1 fallback)
 * Phase 9 จะ migrate ไป Upstash Redis
 * ดู Security.md § 5
 */

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  resetAt: Date;
  lockedUntil: Date | null;
}

export interface RateLimitConfig {
  /** Bucket key (e.g. "login:60001") */
  key: string;
  /** Max attempts allowed in window */
  max: number;
  /** Window in seconds */
  windowSec: number;
  /** Optional lockout duration in seconds after max exceeded */
  lockoutSec?: number;
}

export async function rateLimit(
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = new Date();
  const bucket = await db.rateLimitBucket.findUnique({
    where: { id: config.key },
  });

  // Locked
  if (bucket?.lockedAt) {
    const lockoutMs = (config.lockoutSec ?? 1800) * 1000;
    const unlockAt = new Date(bucket.lockedAt.getTime() + lockoutMs);
    if (unlockAt > now) {
      return {
        allowed: false,
        count: bucket.count,
        resetAt: bucket.resetAt,
        lockedUntil: unlockAt,
      };
    }
    // Lockout expired — reset
    await db.rateLimitBucket.update({
      where: { id: config.key },
      data: {
        count: 0,
        lockedAt: null,
        resetAt: new Date(now.getTime() + config.windowSec * 1000),
      },
    });
    return rateLimit(config);
  }

  // Window expired — reset
  if (!bucket || bucket.resetAt < now) {
    await db.rateLimitBucket.upsert({
      where: { id: config.key },
      create: {
        id: config.key,
        count: 1,
        resetAt: new Date(now.getTime() + config.windowSec * 1000),
      },
      update: {
        count: 1,
        resetAt: new Date(now.getTime() + config.windowSec * 1000),
      },
    });
    return {
      allowed: true,
      count: 1,
      resetAt: new Date(now.getTime() + config.windowSec * 1000),
      lockedUntil: null,
    };
  }

  // Increment
  const updated = await db.rateLimitBucket.update({
    where: { id: config.key },
    data: { count: { increment: 1 } },
  });

  // Exceeded → lock
  if (updated.count > config.max) {
    await db.rateLimitBucket.update({
      where: { id: config.key },
      data: { lockedAt: now },
    });
    const lockoutMs = (config.lockoutSec ?? 1800) * 1000;
    return {
      allowed: false,
      count: updated.count,
      resetAt: updated.resetAt,
      lockedUntil: new Date(now.getTime() + lockoutMs),
    };
  }

  return {
    allowed: true,
    count: updated.count,
    resetAt: updated.resetAt,
    lockedUntil: null,
  };
}
