import { z } from "zod";

/**
 * Shared Zod schemas (client + server)
 * ใช้ที่ API entry, form validation, service layer
 */

// ───── Auth ─────

export const LoginSchema = z.object({
  identifier: z.string().min(3).max(254),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const StudentIdSchema = z
  .string()
  .regex(/^\d{4,10}$/, "เลขประจำตัวต้องเป็นตัวเลข 4-10 หลัก");

export const NameSchema = z
  .string()
  .trim()
  .min(1, "กรุณากรอกข้อมูล")
  .max(100, "ยาวเกินไป");

export const SignupStudentSchema = z
  .object({
    studentId: StudentIdSchema,
    firstName: NameSchema,
    lastName: NameSchema,
    password: z.string().min(8, "รหัสผ่านขั้นต่ำ 8 ตัวอักษร").max(200),
    confirmPassword: z.string().min(1),
    consent: z.literal(true, {
      message: "ต้องยอมรับนโยบายความเป็นส่วนตัวก่อน",
    }),
    // Optional at the schema layer — enforcement happens in verifyTurnstile,
    // which is skipped when TURNSTILE_SECRET_KEY is unset (small private
    // deploys) and enforced when it is set.
    turnstileToken: z.string().optional().default(""),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "รหัสผ่านสองช่องไม่ตรงกัน",
    path: ["confirmPassword"],
  });
export type SignupStudentInput = z.infer<typeof SignupStudentSchema>;

// ───── Password reset ─────

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(8).max(200),
    confirmPassword: z.string().min(1),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "รหัสผ่านใหม่สองช่องไม่ตรงกัน",
    path: ["confirmPassword"],
  });
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
