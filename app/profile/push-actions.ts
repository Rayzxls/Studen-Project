"use server";

import { requireAuth } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";

/**
 * Registers or refreshes one browser's push subscription for the signed-in
 * person (ADR-0047).
 *
 * Keyed on the endpoint, which is what the push service issues, so a browser
 * that re-subscribes updates its row instead of leaving a stale duplicate. It
 * also re-points the row at the current user, which matters on a shared
 * computer: the endpoint belongs to the browser, so whoever is signed in now is
 * the one who should receive its pushes.
 */
export async function savePushSubscriptionAction(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}): Promise<void> {
  const session = await requireAuth();
  const endpoint = input.endpoint.trim();
  if (!endpoint || !input.p256dh.trim() || !input.auth.trim()) return;

  await db.webPushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: session.user.id,
      endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent?.slice(0, 255),
    },
    update: {
      userId: session.user.id,
      p256dh: input.p256dh,
      auth: input.auth,
      lastUsedAt: new Date(),
    },
  });
}

/**
 * Forgets one browser's subscription.
 *
 * Scoped to the caller's own rows: knowing an endpoint string must not be
 * enough to silence somebody else's phone.
 */
export async function deletePushSubscriptionAction(
  endpoint: string
): Promise<void> {
  const session = await requireAuth();
  await db.webPushSubscription.deleteMany({
    where: { endpoint: endpoint.trim(), userId: session.user.id },
  });
}

export async function getMessagePreviewPreferenceAction(
  endpoint: string
): Promise<boolean> {
  const session = await requireAuth();
  const row = await db.webPushSubscription.findFirst({
    where: { endpoint: endpoint.trim(), userId: session.user.id },
    select: { messagePreviewEnabled: true },
  });
  return row?.messagePreviewEnabled ?? true;
}

export async function setMessagePreviewPreferenceAction(
  endpoint: string,
  enabled: boolean
): Promise<void> {
  const session = await requireAuth();
  await db.webPushSubscription.updateMany({
    where: { endpoint: endpoint.trim(), userId: session.user.id },
    data: { messagePreviewEnabled: enabled },
  });
}
