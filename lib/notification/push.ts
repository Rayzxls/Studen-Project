import webpush from "web-push";

import { db } from "@/lib/db/client";

/**
 * Web Push delivery (ADR-0047).
 *
 * Best-effort by design. Every push corresponds to a Notification row that is
 * already written, so a failure costs a nudge and no information — which is
 * what lets this swallow errors rather than failing the action that triggered
 * it. A teacher's post must not fail because a push service was down.
 *
 * Payloads carry a course name and a kind, never a score, a comment or another
 * student's name: the banner is readable by whoever is near the phone.
 */

export type PushMessage = {
  title: string;
  body: string;
  /** Where tapping it should land. */
  url: string;
  /** Collapses repeats of the same event into one banner. */
  tag?: string;
};

let configured: boolean | null = null;

/**
 * Configures web-push once, and reports whether push is available at all.
 *
 * Absent keys are a normal state, not an error: a deployment without them
 * simply does not send, which is how this ships without forcing every
 * environment to hold a VAPID pair.
 */
function ensureConfigured(): boolean {
  if (configured !== null) return configured;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();

  if (!publicKey || !privateKey || !subject) {
    configured = false;
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function pushConfigured(): boolean {
  return ensureConfigured();
}

/**
 * Sends one message to every device a person has registered.
 *
 * A subscription the push service reports as gone (404/410) is deleted rather
 * than retried — the browser was reset or the permission revoked, and keeping
 * the row would mean failing forever.
 */
export async function sendPushToUsers(
  userIds: readonly string[],
  message: PushMessage
): Promise<{ sent: number; removed: number }> {
  if (userIds.length === 0 || !ensureConfigured()) {
    return { sent: 0, removed: 0 };
  }

  const subscriptions = await db.webPushSubscription.findMany({
    where: { userId: { in: [...userIds] } },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subscriptions.length === 0) return { sent: 0, removed: 0 };

  const payload = JSON.stringify(message);
  const gone: string[] = [];
  let sent = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload
        );
        sent += 1;
      } catch (error: unknown) {
        const status =
          typeof error === "object" && error !== null && "statusCode" in error
            ? Number((error as { statusCode: unknown }).statusCode)
            : 0;
        if (status === 404 || status === 410) gone.push(subscription.id);
        // Any other failure is transient from here: the Notification row still
        // exists and the app still shows it, so there is nothing to recover.
      }
    })
  );

  if (gone.length > 0) {
    await db.webPushSubscription.deleteMany({ where: { id: { in: gone } } });
  }

  return { sent, removed: gone.length };
}

/**
 * Pushes one message to every active member of a course.
 *
 * Called after the transaction that wrote the Notification rows has committed,
 * never inside it: a push is a network call to a third party, and holding a
 * database transaction open across one would put someone else's outage on the
 * critical path of a teacher posting work.
 */
export async function sendCoursePush(
  courseOfferingId: string,
  message: PushMessage
): Promise<void> {
  if (!ensureConfigured()) return;

  const enrollments = await db.enrollment.findMany({
    where: { courseOfferingId, removedAt: null },
    select: { studentId: true }, // dependency-gate-allow(student-id-symbol-review): internal Enrollment foreign key to User.id
  });
  const recipients = enrollments.map((e) => e.studentId); // dependency-gate-allow(student-id-symbol-review): internal Enrollment foreign key to User.id
  if (recipients.length === 0) return;

  try {
    await sendPushToUsers(recipients, message);
  } catch {
    // Best-effort by design (ADR-0047): the Notification rows are already
    // written, so the class loses a nudge and no information.
  }
}
