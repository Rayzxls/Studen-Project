import bcrypt from "bcryptjs";

/**
 * Password hashing & verification
 * ดู: Security.md § 1 Password Policy
 */

const BCRYPT_COST = 12;

/** Top 50 common passwords ที่ห้ามใช้ (Phase 1 minimal — Phase 9 ขยายเป็น 10000) */
const COMMON_PASSWORDS = new Set([
  "password",
  "123456",
  "12345678",
  "qwerty",
  "abc123",
  "monkey",
  "letmein",
  "dragon",
  "111111",
  "baseball",
  "iloveyou",
  "trustno1",
  "1234567",
  "sunshine",
  "master",
  "123123",
  "welcome",
  "shadow",
  "ashley",
  "football",
  "jesus",
  "michael",
  "ninja",
  "mustang",
  "password1",
  "password123",
  "123456789",
  "1234567890",
  "1q2w3e4r",
  "qwerty123",
  "admin",
  "admin123",
  "root",
  "toor",
  "test",
  "test123",
  "guest",
  "user",
  "12345",
  "1234",
  "0000",
  "00000000",
  "qazwsx",
  "qwertyuiop",
  "asdfghjkl",
  "p@ssw0rd",
  "p@ssword",
  "passw0rd",
  "studennnn",
  "student",
  "beagle",
  "beagleclassroom",
]);

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function isCommonPassword(plain: string): boolean {
  return COMMON_PASSWORDS.has(plain.toLowerCase());
}

/**
 * Validate password strength per role
 * - Student: min 8 chars
 * - Teacher/Admin: min 12 chars
 * - All: reject common passwords
 */
export function validatePassword(
  plain: string,
  role: "ADMIN" | "TEACHER" | "STUDENT"
): { ok: true } | { ok: false; reason: string } {
  const minLen = role === "STUDENT" ? 8 : 12;
  if (plain.length < minLen) {
    return {
      ok: false,
      reason: `รหัสผ่านสั้นเกินไป (ขั้นต่ำ ${minLen} ตัวอักษร)`,
    };
  }
  if (plain.length > 200) {
    return { ok: false, reason: "รหัสผ่านยาวเกินไป" };
  }
  if (isCommonPassword(plain)) {
    return { ok: false, reason: "รหัสผ่านนี้ถูกใช้กันมาก กรุณาเลือกใหม่" };
  }
  return { ok: true };
}
