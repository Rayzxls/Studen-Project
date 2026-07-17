"use server";

/**
 * Server actions for the bell — Phase 7 · P7-5
 *
 * Pattern 6 — hidden form fields (no .bind), Pattern 10 (no audit —
 * verbose tier). `markReadAndNavigate` accepts only a notification id,
 * verifies recipient ownership, then resolves the route from the stored
 * snapshot. `markAllReadAction` clears every unread row for
 * the recipient; the form submission auto-triggers a router refresh
 * on the calling page, so we don't need an explicit revalidatePath.
 */

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/guards";
import {
  getNotificationForRecipient,
  markNotificationRead,
  markVisibleNotificationsRead,
  markAllNotificationsRead,
} from "@/lib/notification";
import { lessonWorkspaceCourseEnabled } from "@/lib/lesson/feature-flags";
import { resolveNotificationHref } from "@/lib/notification/navigation";

export async function markReadAndNavigate(formData: FormData): Promise<void> {
  const session = await requireAuth();
  const notificationId = String(formData.get("notificationId") ?? "");
  if (!notificationId) redirect("/dashboard");

  const notification = await getNotificationForRecipient({
    notificationId,
    recipientId: session.user.id,
  });
  if (!notification) redirect("/dashboard");

  const href = resolveNotificationHref({
    kind: notification.kind,
    role: session.user.role,
    courseOfferingId: notification.courseOfferingId,
    sourceEntityId: notification.sourceEntityId,
    payload: notification.payloadJson,
    lessonWorkspaceEnabled:
      notification.courseOfferingId !== null &&
      lessonWorkspaceCourseEnabled(notification.courseOfferingId),
  });

  await markNotificationRead({
    notificationId,
    recipientId: session.user.id,
  });
  redirect(href);
}

export async function markVisibleReadAction(
  notificationIds: string[]
): Promise<{ marked: number }> {
  const session = await requireAuth();
  const marked = await markVisibleNotificationsRead({
    notificationIds,
    recipientId: session.user.id,
  });
  return { marked };
}

export async function markAllReadAction(): Promise<void> {
  const session = await requireAuth();
  await markAllNotificationsRead(session.user.id);
}
