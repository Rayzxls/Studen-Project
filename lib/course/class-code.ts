import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit/log";
import { Forbidden, NotFound } from "@/lib/errors";

/**
 * Class Code generator
 * Format: "<PREFIX>-<SUFFIX>" (e.g., "MATH4A-A8K2X3")
 * - Uppercase alphanumeric only
 * - Excludes confusing chars: 0/O, 1/I/L
 * - Length: 6-12 chars total (incl. hyphen)
 * - Uniqueness verified against CourseOffering.classCode
 */

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0,O,1,I,L

function randomChunk(len: number): string {
  // Use rejection sampling for uniform distribution
  const bytes = crypto.randomBytes(len * 2);
  let out = "";
  for (let i = 0; i < bytes.length && out.length < len; i++) {
    const idx = bytes[i] % 32;
    if (idx < ALPHABET.length) out += ALPHABET[idx];
  }
  if (out.length < len) return randomChunk(len); // extremely rare
  return out;
}

/**
 * Generate a class code with subject hint.
 * @param hint  Up to 6 chars used as prefix (default 4 random)
 * @returns code like "MATH4A-A8K2X3"
 */
export function generateClassCode(hint?: string): string {
  const prefix = hint
    ? hint
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .replace(/[0OIL1]/g, "")
        .slice(0, 6)
        .padEnd(4, randomChunk(1))
    : randomChunk(4);
  const suffix = randomChunk(6);
  return `${prefix}-${suffix}`;
}

/** Generate a unique code, retrying on collision (extremely rare) */
export async function generateUniqueClassCode(hint?: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateClassCode(hint);
    const existing = await db.courseOffering.findUnique({
      where: { classCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new Error("Failed to generate unique class code after 10 attempts");
}

/**
 * Validate a code's format (does NOT check DB uniqueness)
 * Used for /join input sanitization
 */
export function isValidClassCodeFormat(code: string): boolean {
  // 4-8 prefix, hyphen, 4-8 suffix; uppercase alphanumeric (without confusing chars)
  return /^[A-Z0-9]{2,8}-[A-Z0-9]{2,8}$/.test(code);
}

/**
 * Normalize user-entered code: trim, uppercase, replace confusing chars with similar ones.
 * Example: "math4a-a8k2x3 " → "MATH4A-A8K2X3"
 *          "math4a-08k2x3" → "MATH4A-O8K2X3" (keeps 0 as 0 since it might be intentional)
 */
export function normalizeClassCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9-]/g, "");
}

// ═══════════════════════════════════════════════════════════
// Class Code mutation wrappers (Phase 3 P3-5/3 — Settings tab)
// ═══════════════════════════════════════════════════════════
//
// All wrappers enforce teacher-ownership inside the same $transaction
// as the mutation + audit (same pattern as lib/course/enrollment.removeMember).
// Admin-side controls are deferred to Phase 8.
//
// Audit event names use the past-tense family CLASS_CODE_* established
// in this commit.

async function assertOwningTeacherInTx(
  tx: Prisma.TransactionClient,
  courseOfferingId: string,
  actorUserId: string
): Promise<{
  classCode: string;
  codeActive: boolean;
  codeExpiresAt: Date | null;
}> {
  const course = await tx.courseOffering.findUnique({
    where: { id: courseOfferingId },
    select: {
      teacherId: true,
      classCode: true,
      codeActive: true,
      codeExpiresAt: true,
    },
  });
  if (!course) throw new NotFound("course_not_found");
  if (course.teacherId !== actorUserId) throw new Forbidden("not_course_owner");
  return {
    classCode: course.classCode,
    codeActive: course.codeActive,
    codeExpiresAt: course.codeExpiresAt,
  };
}

/**
 * Generate a fresh code + replace the existing one. Old code is dead
 * immediately — students mid-join will see the same `class_code_invalid`
 * the wrapper returns for any stale code.
 */
export async function regenerateClassCode(params: {
  courseOfferingId: string;
  actorUserId: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ classCode: string }> {
  const newCode = await generateUniqueClassCode();

  await db.$transaction(async (tx) => {
    const before = await assertOwningTeacherInTx(
      tx,
      params.courseOfferingId,
      params.actorUserId
    );
    await tx.courseOffering.update({
      where: { id: params.courseOfferingId },
      data: { classCode: newCode },
    });
    await audit(
      {
        actorId: params.actorUserId,
        actorRole: "TEACHER",
        action: "CLASS_CODE_REGENERATED",
        targetType: "CourseOffering",
        targetId: params.courseOfferingId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        before: { classCode: before.classCode },
        after: { classCode: newCode },
      },
      tx
    );
  });

  return { classCode: newCode };
}

/**
 * Toggle `codeActive`. ADR-0013 § 2 — this is the documented permanent
 * block for a removed student (deactivate prevents both new joins and
 * rejoin-restores).
 */
export async function setClassCodeActive(params: {
  courseOfferingId: string;
  actorUserId: string;
  active: boolean;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  await db.$transaction(async (tx) => {
    const before = await assertOwningTeacherInTx(
      tx,
      params.courseOfferingId,
      params.actorUserId
    );
    if (before.codeActive === params.active) return; // idempotent no-op
    await tx.courseOffering.update({
      where: { id: params.courseOfferingId },
      data: { codeActive: params.active },
    });
    await audit(
      {
        actorId: params.actorUserId,
        actorRole: "TEACHER",
        action: params.active
          ? "CLASS_CODE_REACTIVATED"
          : "CLASS_CODE_DEACTIVATED",
        targetType: "CourseOffering",
        targetId: params.courseOfferingId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        before: { codeActive: before.codeActive },
        after: { codeActive: params.active },
      },
      tx
    );
  });
}

/**
 * Set (or clear) the code expiry. `null` means "ใช้งานได้ตลอด".
 * Single audit event covers both directions — before/after captures the
 * actual transition.
 */
export async function setClassCodeExpiry(params: {
  courseOfferingId: string;
  actorUserId: string;
  expiresAt: Date | null;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  await db.$transaction(async (tx) => {
    const before = await assertOwningTeacherInTx(
      tx,
      params.courseOfferingId,
      params.actorUserId
    );
    const beforeIso = before.codeExpiresAt?.toISOString() ?? null;
    const afterIso = params.expiresAt?.toISOString() ?? null;
    if (beforeIso === afterIso) return; // idempotent no-op
    await tx.courseOffering.update({
      where: { id: params.courseOfferingId },
      data: { codeExpiresAt: params.expiresAt },
    });
    await audit(
      {
        actorId: params.actorUserId,
        actorRole: "TEACHER",
        action: "CLASS_CODE_EXPIRY_SET",
        targetType: "CourseOffering",
        targetId: params.courseOfferingId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        before: { codeExpiresAt: beforeIso },
        after: { codeExpiresAt: afterIso },
      },
      tx
    );
  });
}
