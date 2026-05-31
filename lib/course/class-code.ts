import crypto from "node:crypto";
import { db } from "@/lib/db/client";

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
