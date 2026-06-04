/**
 * Shared constants for `lib/assignment/*` — Phase 6
 * See: ADR-0019 (Assignment ↔ ScoreItem coupling) · ADR-0020 (Submission lifecycle) · ADR-0021 (file upload pipeline)
 */

/**
 * Transaction options for assignment / submission / comment mutations.
 * Same posture as `lib/scoring/constants.ts` (Pattern 3) — Neon cold-start
 * can exceed Prisma's default 2 s `maxWait`.
 */
export const TX_OPTS = { maxWait: 10_000, timeout: 15_000 } as const;

/**
 * Reason field length bounds — used by:
 *   - `SUBMISSION_RETURNED` (Important · the private comment body doubles as the audit reason · ADR-0020 § 4)
 *   - `COMMENT_MODERATED` (Important when Teacher, Critical when Admin × PRIVATE · CONTEXT § Comment Moderation)
 *   - `FILE_DELETED` (Important · when moderated)
 *
 * Matches Phase 4/5 audit family for consistency.
 */
export const REASON_MIN = 5;
export const REASON_MAX = 500;

// ─────────────────────────────────────────────────────────────
// Assignment field caps
// ─────────────────────────────────────────────────────────────

/** Assignment title cap (validated at API boundary). */
export const TITLE_MAX = 200;
/** Assignment description (markdown subset) cap. */
export const DESCRIPTION_MAX = 10_000;

// ─────────────────────────────────────────────────────────────
// SubmissionVersion field caps
// ─────────────────────────────────────────────────────────────

/** SubmissionVersion textContent (markdown subset) cap. */
export const TEXT_CONTENT_MAX = 50_000;

/** Max links attached to one SubmissionVersion. */
export const MAX_LINKS_PER_VERSION = 10;
/** Max length of one link URL (RFC-conformant URLs almost always fit in 2000). */
export const LINK_URL_MAX = 2_000;

// ─────────────────────────────────────────────────────────────
// Comment field caps + edit window
// ─────────────────────────────────────────────────────────────

/** Comment.body cap — typical conversational length, generous enough for RETURN comments. */
export const COMMENT_BODY_MAX = 2_000;

/**
 * Author self-edit window — CONTEXT § Comment Moderation lock:
 * "ครู/นักเรียนแก้ comment ของตัวเองได้ภายใน 5 นาทีหลังโพสต์ → หลังจากนั้น immutable".
 *
 * `editedAt` is set when an edit lands; subsequent edits clamp to
 * `createdAt + COMMENT_EDIT_WINDOW_MS` (the window is anchored to creation,
 * not to the previous edit — same posture as Twitter/X "edit within X min").
 */
export const COMMENT_EDIT_WINDOW_MS = 5 * 60 * 1_000;

// ─────────────────────────────────────────────────────────────
// FileAttachment limits (ADR-0021 · also referenced by lib/storage in P6-3)
// ─────────────────────────────────────────────────────────────

/** Max file size — CLAUDE.md § Performance Budget (20 MB binary). */
export const FILE_MAX_BYTES = 20 * 1024 * 1024;

/**
 * MIME allow-list (ADR-0021 § 4). Block-list approach would miss novel MIME
 * values; allow-list is auditable and easy to extend behind code review.
 *
 *   PDF                                              application/pdf
 *   Images (iOS native HEIC/HEIF transcoded → JPEG)  image/jpeg, image/png, image/webp, image/heic, image/heif
 *   Office (OOXML only — legacy .doc/.xls/.ppt out)  DOCX / XLSX / PPTX
 *
 * Blocked (decided in ADR-0021 § Rejected Alternatives):
 *   SVG (XSS vector — CLAUDE.md hard rule), GIF, TXT/MD, ZIP/RAR/7Z,
 *   audio/video, all executables.
 */
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;

export type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number];

// ─────────────────────────────────────────────────────────────
// Phase 6 audit event names — past-tense per Pattern 10
// ─────────────────────────────────────────────────────────────
//
// These mirror the Phase 5 convention (constants exported from
// `lib/scoring/constants.ts`) so the audit family is discoverable from
// one place and the string literals are not scattered across fire sites.

/** ADR-0020 § 4 — workflow signal from teacher; reason = comment body. */
export const AUDIT_SUBMISSION_RETURNED = "SUBMISSION_RETURNED";

/**
 * ADR-0020 § 4 — fires only when `isScored: true → false` toggle removes a
 * draft-with-N-entries (block) or escalates a publish-state escape. Verbose
 * tier for normal field edits; not fired here.
 */
export const AUDIT_ASSIGNMENT_UPDATED = "ASSIGNMENT_UPDATED";

/** CONTEXT § Comment Moderation — Teacher: Important · Admin × PRIVATE: Critical. */
export const AUDIT_COMMENT_MODERATED = "COMMENT_MODERATED";

/** ADR-0021 — file passes magic-byte + EXIF strip, lands in permanent/. */
export const AUDIT_FILE_UPLOADED = "FILE_UPLOADED";

/** ADR-0021 — magic-byte mismatch, MIME not whitelisted, size exceeds, etc. */
export const AUDIT_FILE_REJECTED = "FILE_REJECTED";

/** ADR-0021 — owner removes attachment or moderator deletes. */
export const AUDIT_FILE_DELETED = "FILE_DELETED";

/** ADR-0021 — enum slot reserved; no fire site in Phase 6 (AV deferred to Phase 9). */
export const AUDIT_FILE_INFECTED_BLOCKED = "FILE_INFECTED_BLOCKED";
