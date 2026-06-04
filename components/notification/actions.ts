"use server";

/**
 * Server actions for the bell — Phase 7 · P7-5
 *
 * Pattern 6 — hidden form fields (no .bind), Pattern 10 (no audit —
 * verbose tier). `markReadAndNavigate` marks one row read then
 * redirects to the entity URL resolved at server-render time (passed
 * as a hidden input). `markAllReadAction` clears every unread row for
 * the recipient; the form submission auto-triggers a router refresh
 * on the calling page, so we don't need an explicit revalidatePath.
 */

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/guards";
import {
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/notification";

export async function markReadAndNavigate(formData: FormData): Promise<void> {
  const session = await requireAuth();
  const notificationId = String(formData.get("notificationId") ?? "");
  const href = String(formData.get("href") ?? "/dashboard");
  if (notificationId) {
    await markNotificationRead({
      notificationId,
      recipientId: session.user.id,
    });
  }
  redirect(href);
}

export async function markAllReadAction(): Promise<void> {
  const session = await requireAuth();
  await markAllNotificationsRead(session.user.id);
}
