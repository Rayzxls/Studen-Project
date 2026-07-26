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

export const NameSchema = z
  .string()
  .trim()
  .min(1, "กรุณากรอกข้อมูล")
  .max(100, "ยาวเกินไป");

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
