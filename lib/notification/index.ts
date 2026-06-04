/**
 * lib/notification — Phase 7 · ADR-0022
 *
 * Public surface. Mutation sites import the fan-out + suppress helpers;
 * the bell UI imports the read-side queries.
 */

export {
  POST_ONCE_KINDS,
  isPostOnceKind,
  PAYLOAD_EXCERPT_MAX,
  clipExcerpt,
} from "./constants";

export type {
  NotificationPayload,
  ScoreItemPublishedPayload,
  AssignmentPostedPayload,
  MaterialPostedPayload,
  AnnouncementPostedPayload,
  ScoreEntryEditedPayload,
  SubmissionGradedPayload,
  SubmissionReturnedPayload,
  CommentRepliedPayload,
  ClassCodeJoinedPayload,
} from "./types";

export {
  fanOutBroadcast,
  fanOutTargeted,
  fanOutTargetedMany,
  fanOutThread,
} from "./fan-out";

export {
  suppressNotificationsForRemovedMember,
  unsuppressNotificationsOnRestore,
  suppressNotificationsForDeletedEntity,
} from "./suppress";

export {
  listNotificationsForRecipient,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "./queries";
