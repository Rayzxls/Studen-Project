/**
 * Notification payload types — Phase 7 · ADR-0022 § 4
 *
 * Snapshot shape captured at fan-out time. Bell renders without
 * joining source tables — see ADR-0022 § 4 ("entity edits do not
 * propagate to bell rows").
 *
 * Each kind has its own payload shape. Callers build the snapshot at
 * the mutation site (where the source row is already in scope) and
 * pass it to the fan-out helper.
 */

import type { NotifEntityType, NotificationKind } from "@prisma/client";

interface BasePayload {
  courseId?: string;
  courseName?: string;
}

// ─── Broadcast kinds ─────────────────────────────────────────

export interface ScoreItemPublishedPayload extends BasePayload {
  itemName: string;
  publishedAt: string; // ISO instant
}

export interface AssignmentPostedPayload extends BasePayload {
  assignmentTitle: string;
  dueAt: string | null; // ISO instant or null
}

export interface MaterialPostedPayload extends BasePayload {
  title: string;
  postedByName: string;
}

export interface AnnouncementPostedPayload extends BasePayload {
  title: string | null;
  bodyExcerpt: string;
  postedByName: string;
}

// ─── Targeted kinds (1 recipient) ────────────────────────────

export interface ScoreEntryEditedPayload extends BasePayload {
  itemName: string;
}

export interface SubmissionGradedPayload extends BasePayload {
  assignmentId: string;
  assignmentTitle: string;
  graderName: string;
}

export interface SubmissionReturnedPayload extends BasePayload {
  assignmentId: string;
  assignmentTitle: string;
  commentExcerpt: string;
  teacherName: string;
}

// ─── Thread kind ─────────────────────────────────────────────

export interface CommentRepliedPayload extends BasePayload {
  entityKind: "ASSIGNMENT" | "MATERIAL" | "ANNOUNCEMENT" | "SUBMISSION";
  /**
   * Identifier of the entity the comment was posted under — drives the
   * bell's deep-link URL (Phase 9 P9-1). For SUBMISSION this is the
   * Submission's parent `Assignment.id` so the bell lands on the
   * assignment detail rather than the bare submissions list.
   */
  entityOwnerId: string;
  entityTitle: string | null;
  commenterName: string;
  commentExcerpt: string;
}

// ─── Teacher kind ────────────────────────────────────────────

export interface ClassCodeJoinedPayload extends BasePayload {
  studentName: string;
  classCode: string;
}

// ─── Discriminated union ─────────────────────────────────────

export type NotificationPayload =
  | { kind: "SCORE_ITEM_PUBLISHED"; data: ScoreItemPublishedPayload }
  | { kind: "ASSIGNMENT_POSTED"; data: AssignmentPostedPayload }
  | { kind: "MATERIAL_POSTED"; data: MaterialPostedPayload }
  | { kind: "ANNOUNCEMENT_POSTED"; data: AnnouncementPostedPayload }
  | { kind: "SCORE_ENTRY_EDITED"; data: ScoreEntryEditedPayload }
  | { kind: "SUBMISSION_GRADED"; data: SubmissionGradedPayload }
  | { kind: "SUBMISSION_RETURNED"; data: SubmissionReturnedPayload }
  | { kind: "COMMENT_REPLIED"; data: CommentRepliedPayload }
  | { kind: "CLASS_CODE_JOINED"; data: ClassCodeJoinedPayload };

/** Compile-time check that the discriminator covers every NotificationKind. */
type _AssertKindCoverage = NotificationPayload["kind"] extends NotificationKind
  ? true
  : false;
type _AssertEntityCoverage = NotifEntityType extends NotifEntityType
  ? true
  : false;
const _kindCheck: _AssertKindCoverage = true;
const _entityCheck: _AssertEntityCoverage = true;
void _kindCheck;
void _entityCheck;
