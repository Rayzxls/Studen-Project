/**
 * Zod schemas for `lib/assignment/*` — Phase 6
 *
 * Shared between client (form validation in Server Actions / dialogs) and
 * server (API entry validation). Mirrors `lib/validation/*.ts` posture
 * established in Phase 2.
 *
 * Field caps live in `./constants.ts` so a single edit shifts every site
 * that validates the same shape.
 */

import { z } from "zod";
import {
  ALLOWED_MIME_TYPES,
  COMMENT_BODY_MAX,
  DESCRIPTION_MAX,
  FILE_MAX_BYTES,
  LINK_URL_MAX,
  MAX_LINKS_PER_VERSION,
  REASON_MAX,
  REASON_MIN,
  TEXT_CONTENT_MAX,
  TITLE_MAX,
} from "./constants";

// ─────────────────────────────────────────────────────────────
// Assignment
// ─────────────────────────────────────────────────────────────

/**
 * Weight (basis points 0..10000) — only required when `isScored=true`.
 * Mirrors `lib/scoring` ScoreItemWeightSchema (ADR-0017 § 1) but expressed
 * inline so client form code can pull it without an extra cross-import.
 */
const WeightBpSchema = z
  .number({ message: "ระบุน้ำหนัก" })
  .int("น้ำหนักต้องเป็นจำนวนเต็ม (basis points)")
  .min(1, "น้ำหนักต้องมากกว่า 0 (ADR-0019 § 2 — no zero default)")
  .max(10_000, "น้ำหนักรวมต้องไม่เกิน 100%");

const FullScoreSchema = z
  .number({ message: "ระบุคะแนนเต็ม" })
  .int("คะแนนเต็มต้องเป็นจำนวนเต็ม")
  .min(1, "คะแนนเต็มต้องมากกว่า 0");

/**
 * Create Assignment input.
 *
 * ADR-0019: when `isScored=true`, both `weight` and `fullScore` are
 * required (no system-chosen default). The schema enforces this with a
 * cross-field refine so a single submit cannot drift between the two
 * states.
 */
export const CreateAssignmentSchema = z
  .object({
    courseOfferingId: z.string().min(1, "ระบุวิชา"),
    title: z.string().trim().min(1, "ตั้งชื่อการบ้าน").max(TITLE_MAX),
    description: z.string().max(DESCRIPTION_MAX, "คำอธิบายยาวเกินไป"),
    dueAt: z.coerce.date().nullable().optional(),
    allowText: z.boolean(),
    allowFile: z.boolean(),
    allowLink: z.boolean(),
    submissionClosed: z.boolean().optional().default(false),
    autoCloseAtDue: z.boolean().optional().default(false),
    isScored: z.boolean(),
    weight: WeightBpSchema.optional(),
    fullScore: FullScoreSchema.optional(),
  })
  .refine((v) => v.allowText || v.allowFile || v.allowLink, {
    message: "ต้องอนุญาตอย่างน้อย 1 ช่องทาง (ข้อความ / ไฟล์ / ลิงก์)",
    path: ["allowText"],
  })
  .refine((v) => !v.isScored || v.weight !== undefined, {
    message: "ระบุน้ำหนักของรายการคะแนน (ADR-0019)",
    path: ["weight"],
  })
  .refine((v) => !v.isScored || v.fullScore !== undefined, {
    message: "ระบุคะแนนเต็ม (ADR-0019)",
    path: ["fullScore"],
  });

// Use z.input so callers may omit fields with `.default()` — the Zod
// parser still produces a fully-populated value at the lib layer.
export type CreateAssignmentInput = z.input<typeof CreateAssignmentSchema>;

/**
 * Update Assignment input. `isScored` toggle here triggers the 3-state
 * dispatch in `updateAssignment` per ADR-0019 § 5 (draft+0 atomic delete,
 * draft+N block, published block).
 *
 * `weight` and `fullScore` are accepted only on the false→true flip — the
 * lib layer rejects them on the true→false flip with `not_scored`.
 */
export const UpdateAssignmentSchema = z.object({
  title: z.string().trim().min(1).max(TITLE_MAX).optional(),
  description: z.string().max(DESCRIPTION_MAX).optional(),
  dueAt: z.coerce.date().nullable().optional(),
  allowText: z.boolean().optional(),
  allowFile: z.boolean().optional(),
  allowLink: z.boolean().optional(),
  submissionClosed: z.boolean().optional(),
  autoCloseAtDue: z.boolean().optional(),
  isScored: z.boolean().optional(),
  weight: WeightBpSchema.optional(),
  fullScore: FullScoreSchema.optional(),
});

export type UpdateAssignmentInput = z.infer<typeof UpdateAssignmentSchema>;

// ─────────────────────────────────────────────────────────────
// SubmissionVersion
// ─────────────────────────────────────────────────────────────

/**
 * URL string — sanity-checked at the API boundary (`URL` parse + length
 * cap). The lib layer does NOT fetch the URL or rewrite it; it stores
 * exactly what the student typed.
 */
const LinkUrlSchema = z
  .string()
  .trim()
  .min(1, "ลิงก์ว่าง")
  .max(LINK_URL_MAX, "ลิงก์ยาวเกินไป")
  .refine(
    (s) => {
      try {
        const u = new URL(s);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "ลิงก์ไม่ถูกต้อง (ต้องขึ้นต้นด้วย http:// หรือ https://)" }
  );

/**
 * Submit a SubmissionVersion. At least one of textContent / files / links
 * must be present — empty submits are nonsense and the API rejects them.
 *
 * The Assignment's allow* toggles are validated at the service layer (not
 * here) because the schema doesn't have access to the Assignment row.
 */
export const SubmitVersionSchema = z
  .object({
    /**
     * Optional UI hint — lib/assignment.submitVersion calls
     * findOrCreateSubmission(assignmentId, enrollmentId) internally so this
     * value is never required for correctness. The Student detail page still
     * sends it when a Submission already exists, so the UI can render the
     * version history independently of this round-trip.
     */
    submissionId: z.string().optional(),
    textContent: z
      .string()
      .max(TEXT_CONTENT_MAX, "ข้อความยาวเกินไป")
      .optional(),
    /** FileAttachment ids already uploaded via the R2 commit endpoint. */
    fileAttachmentIds: z.array(z.string().min(1)).max(MAX_LINKS_PER_VERSION),
    links: z.array(LinkUrlSchema).max(MAX_LINKS_PER_VERSION, "ลิงก์เยอะเกินไป"),
  })
  .refine(
    (v) =>
      (v.textContent?.trim().length ?? 0) > 0 ||
      v.fileAttachmentIds.length > 0 ||
      v.links.length > 0,
    {
      message: "ต้องส่งอย่างน้อย 1 อย่าง (ข้อความ / ไฟล์ / ลิงก์)",
      path: ["textContent"],
    }
  );

export type SubmitVersionInput = z.infer<typeof SubmitVersionSchema>;

// ─────────────────────────────────────────────────────────────
// Comment
// ─────────────────────────────────────────────────────────────

/**
 * CommentOwnerType enum from Prisma — replicated here to keep the
 * validation file dependency-free of @prisma/client at runtime (Zod
 * inference works without it).
 */
export const CommentOwnerTypeSchema = z.enum([
  "ASSIGNMENT",
  "MATERIAL",
  "ANNOUNCEMENT",
  "SUBMISSION",
]);

export const CommentScopeSchema = z.enum(["CLASS_WIDE", "PRIVATE"]);

/** Generic comment body — min 1 (allow short replies), max COMMENT_BODY_MAX. */
const CommentBodySchema = z
  .string()
  .trim()
  .min(1, "เขียนข้อความก่อน")
  .max(COMMENT_BODY_MAX, "ข้อความยาวเกินไป");

/** Body used as a `reason` (RETURN, moderation) — must clear REASON_MIN. */
const ReasonBodySchema = z
  .string()
  .trim()
  .min(REASON_MIN, `อย่างน้อย ${REASON_MIN} ตัวอักษร`)
  .max(REASON_MAX, "เหตุผลยาวเกินไป");

export const CreateCommentSchema = z.object({
  ownerType: CommentOwnerTypeSchema,
  ownerId: z.string().min(1),
  scope: CommentScopeSchema,
  body: CommentBodySchema,
});
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;

export const EditCommentSchema = z.object({
  commentId: z.string().min(1),
  body: CommentBodySchema,
});
export type EditCommentInput = z.infer<typeof EditCommentSchema>;

/**
 * Moderator delete (Teacher / Admin) — reason required (≥ 5 chars).
 * Author self-delete uses a separate code path with no reason field.
 */
export const ModerateCommentSchema = z.object({
  commentId: z.string().min(1),
  reason: ReasonBodySchema,
});
export type ModerateCommentInput = z.infer<typeof ModerateCommentSchema>;

/**
 * RETURN a Submission. The `comment` text doubles as the audit `reason`
 * per ADR-0020 § 4 — one place to write, one place to read.
 */
export const ReturnSubmissionSchema = z.object({
  submissionId: z.string().min(1),
  comment: ReasonBodySchema,
});
export type ReturnSubmissionInput = z.infer<typeof ReturnSubmissionSchema>;

// ─────────────────────────────────────────────────────────────
// FileAttachment (presign payload — consumed by lib/storage in P6-3)
// ─────────────────────────────────────────────────────────────

export const FileOwnerTypeSchema = z.enum([
  "ASSIGNMENT",
  "MATERIAL",
  "ANNOUNCEMENT",
  "SUBMISSION_VERSION",
  "COMMENT",
]);

const AllowedMimeSchema = z.enum(
  ALLOWED_MIME_TYPES as readonly [string, ...string[]]
);

export const PresignUploadSchema = z.object({
  ownerType: FileOwnerTypeSchema,
  ownerId: z.string().min(1),
  declaredMime: AllowedMimeSchema,
  declaredSize: z.number().int().min(1).max(FILE_MAX_BYTES),
  originalFilename: z.string().trim().min(1).max(255),
});
export type PresignUploadInput = z.infer<typeof PresignUploadSchema>;
