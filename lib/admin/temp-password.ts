import crypto from "node:crypto";

/**
 * Generate a memorable, distinctive temp password for new teachers.
 * Format: TempPass-XXXXXXXX (17 chars, no confusing 0/O/1/I/L)
 *
 * Always meets the 12-char minimum for TEACHER/ADMIN role.
 */
const SAFE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateTempPassword(): string {
  const bytes = crypto.randomBytes(8);
  let suffix = "";
  for (const b of bytes) {
    suffix += SAFE[b % SAFE.length];
  }
  return `TempPass-${suffix}`;
}
