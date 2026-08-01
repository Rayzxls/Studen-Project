export type ScheduledContentKind = "ANNOUNCEMENT" | "MATERIAL" | "ASSIGNMENT";

export type PublishingStatus =
  | "SCHEDULED"
  | "LIVE_NOTIFYING"
  | "LIVE_NOTIFIED"
  | "LIVE_NOTIFICATION_INCOMPLETE"
  | "LIVE_NO_STUDENTS";

export interface PublishingStatusInput {
  now: Date;
  publishAt: Date;
  notifiedAt: Date | null;
  activeStudentCount: number;
  /** Enrollment snapshot expected to receive the notification fan-out. */
  notificationTargetCount?: number;
  notificationCount: number;
}

/**
 * Separates three facts that the UI must not blur together:
 * visibility, notification fan-out, and actual content views.
 *
 * A scheduled row becomes visible by clock comparison. `notifiedAt` only
 * records that the sweep claimed the row, so recipient Notification rows are
 * the stronger evidence that fan-out completed.
 */
export function derivePublishingStatus(
  input: PublishingStatusInput
): PublishingStatus {
  if (input.publishAt.getTime() > input.now.getTime()) return "SCHEDULED";
  if (input.activeStudentCount === 0) return "LIVE_NO_STUDENTS";
  const target = input.notificationTargetCount ?? input.activeStudentCount;
  if (input.notificationCount >= target) {
    return "LIVE_NOTIFIED";
  }
  if (input.notifiedAt !== null) return "LIVE_NOTIFICATION_INCOMPLETE";
  return "LIVE_NOTIFYING";
}

export interface PublishingQueueCandidate {
  kind: ScheduledContentKind;
  title: string;
  publishAt: Date;
}

export function summarizePublishingQueue<T extends PublishingQueueCandidate>(
  items: readonly T[],
  now: Date = new Date()
): { count: number; next: T | null } {
  const waiting = items
    .filter((item) => item.publishAt.getTime() > now.getTime())
    .sort((a, b) => a.publishAt.getTime() - b.publishAt.getTime());
  return { count: waiting.length, next: waiting[0] ?? null };
}
