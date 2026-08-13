import * as Sentry from "@sentry/nextjs";
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

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  } catch (error) {
    // A malformed subject throws here. Left unhandled it would surface as a
    // failed publish sweep rather than as what it is — a settings problem.
    configured = false;
    Sentry.captureException(error, {
      level: "warning",
      tags: { area: "web_push", reason: "vapid_details_rejected" },
    });
    return false;
  }
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
): Promise<PushOutcome> {
  if (userIds.length === 0) return { ...EMPTY_OUTCOME, configured: true };
  if (!ensureConfigured()) {
    reportUnconfigured();
    return EMPTY_OUTCOME;
  }

  const subscriptions = await db.webPushSubscription.findMany({
    where: { userId: { in: [...userIds] } },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subscriptions.length === 0) {
    return { ...EMPTY_OUTCOME, configured: true };
  }

  const payload = JSON.stringify(message);
  const gone: string[] = [];
  const failures: number[] = [];
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
        else failures.push(status);
        // Any other failure is transient from here: the Notification row still
        // exists and the app still shows it, so there is nothing to recover.
      }
    })
  );

  if (gone.length > 0) {
    await db.webPushSubscription.deleteMany({ where: { id: { in: gone } } });
  }
  if (failures.length > 0) reportFailures(failures, sent);

  return {
    sent,
    removed: gone.length,
    failed: failures.length,
    configured: true,
  };
}

/**
 * Chat is the one ADR-0049 exception allowed to carry content. The preview
 * decision belongs to each subscription row, so two devices on one account
 * may receive different payloads without changing the in-app notification.
 */
export async function sendChatPushToUsers(
  userIds: readonly string[],
  args: {
    senderName: string;
    messageBody: string;
    url: string;
    tag?: string;
  }
): Promise<PushOutcome> {
  if (userIds.length === 0) return { ...EMPTY_OUTCOME, configured: true };
  if (!ensureConfigured()) {
    reportUnconfigured();
    return EMPTY_OUTCOME;
  }
  const subscriptions = await db.webPushSubscription.findMany({
    where: { userId: { in: [...userIds] } },
    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      auth: true,
      messagePreviewEnabled: true,
    },
  });
  if (subscriptions.length === 0) {
    return { ...EMPTY_OUTCOME, configured: true };
  }

  const gone: string[] = [];
  const failures: number[] = [];
  let sent = 0;
  await Promise.all(
    subscriptions.map(async (subscription) => {
      const message: PushMessage = subscription.messagePreviewEnabled
        ? {
            title: args.senderName,
            body: args.messageBody,
            url: args.url,
            tag: args.tag,
          }
        : {
            title: "ข้อความใหม่",
            body: "แตะเพื่อเปิด Beagle Classroom",
            url: args.url,
            tag: args.tag,
          };
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(message)
        );
        sent += 1;
      } catch (error: unknown) {
        const status =
          typeof error === "object" && error !== null && "statusCode" in error
            ? Number((error as { statusCode: unknown }).statusCode)
            : 0;
        if (status === 404 || status === 410) gone.push(subscription.id);
        else failures.push(status);
      }
    })
  );
  if (gone.length > 0) {
    await db.webPushSubscription.deleteMany({ where: { id: { in: gone } } });
  }
  if (failures.length > 0) reportFailures(failures, sent);
  return {
    sent,
    removed: gone.length,
    failed: failures.length,
    configured: true,
  };
}

export async function sendCourseChatPush(args: {
  courseOfferingId: string;
  senderId: string;
  senderName: string;
  messageBody: string;
}): Promise<PushOutcome> {
  const course = await db.courseOffering.findUnique({
    where: { id: args.courseOfferingId },
    select: {
      teacherId: true,
      enrollments: {
        where: { removedAt: null },
        select: { studentId: true }, // dependency-gate-allow(student-id-symbol-review): internal Enrollment foreign key to User.id
      },
    },
  });
  if (!course) return { ...EMPTY_OUTCOME, configured: pushConfigured() };
  const recipients = [
    course.teacherId,
    ...course.enrollments.map((enrollment) => enrollment.studentId), // dependency-gate-allow(student-id-symbol-review): internal Enrollment foreign key to User.id
  ].filter((userId) => userId !== args.senderId);
  try {
    return await sendChatPushToUsers(recipients, {
      senderName: args.senderName,
      messageBody: args.messageBody,
      url: `/chat/course/${args.courseOfferingId}`,
      tag: `chat-course-${args.courseOfferingId}`,
    });
  } catch {
    return { ...EMPTY_OUTCOME, configured: pushConfigured() };
  }
}

/**
 * What one send attempt did.
 *
 * `configured: false` is the case that used to be indistinguishable from
 * "nobody was subscribed": a deployment missing its VAPID pair sends nothing
 * and says nothing, and the only visible symptom is a phone that stays quiet
 * while the in-app notification arrives normally.
 */
export type PushOutcome = {
  sent: number;
  /** Subscriptions the push service reported as gone, and we deleted. */
  removed: number;
  /** Sends that failed for another reason — a wrong key pair, most likely. */
  failed: number;
  configured: boolean;
};

const EMPTY_OUTCOME: PushOutcome = {
  sent: 0,
  removed: 0,
  failed: 0,
  configured: false,
};

let unconfiguredReported = false;

/**
 * Says once per instance that push is switched off while something wanted to
 * send. Once, because a deployment without keys would otherwise report this on
 * every post, and the fact does not change between them.
 */
function reportUnconfigured(): void {
  if (unconfiguredReported) return;
  unconfiguredReported = true;
  Sentry.captureMessage("web_push_not_configured", {
    level: "warning",
    tags: { area: "web_push", reason: "missing_vapid_env" },
  });
}

/**
 * Reports failed sends by status code only.
 *
 * Never the endpoint: a push endpoint is a capability URL — anyone holding it
 * can deliver to that device — so it belongs in the same box as a signed URL
 * and stays out of logs.
 */
function reportFailures(statuses: readonly number[], sent: number): void {
  Sentry.captureMessage("web_push_send_failed", {
    level: "warning",
    tags: { area: "web_push", first_status: String(statuses[0] ?? 0) },
    extra: {
      failed: statuses.length,
      sent,
      statusCodes: [...new Set(statuses)],
    },
  });
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
): Promise<PushOutcome> {
  const enrollments = await db.enrollment.findMany({
    where: { courseOfferingId, removedAt: null },
    select: { studentId: true }, // dependency-gate-allow(student-id-symbol-review): internal Enrollment foreign key to User.id
  });
  const recipients = enrollments.map((e) => e.studentId); // dependency-gate-allow(student-id-symbol-review): internal Enrollment foreign key to User.id
  if (recipients.length === 0) {
    return { ...EMPTY_OUTCOME, configured: pushConfigured() };
  }

  try {
    return await sendPushToUsers(recipients, message);
  } catch {
    // Best-effort by design (ADR-0047): the Notification rows are already
    // written, so the class loses a nudge and no information.
    return { ...EMPTY_OUTCOME, configured: pushConfigured() };
  }
}
