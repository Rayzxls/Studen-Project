import { z } from "zod";

export const JoinSchema = z.object({
  code: z.string().min(3).max(32),
});
export type JoinInput = z.infer<typeof JoinSchema>;

/**
 * Create CourseOffering — workspace model (ADR-0012)
 * Teacher writes everything themselves.
 */
export const CreateCourseSchema = z.object({
  name: z.string().trim().min(1, "กรุณาตั้งชื่อวิชา").max(200, "ชื่อยาวเกินไป"),
  subjectCode: z
    .string()
    .trim()
    .max(20, "รหัสยาวเกินไป")
    .optional()
    .or(z.literal("")),
  learnerGroupLabel: z
    .string()
    .trim()
    .max(80, "ชื่อกลุ่มผู้เรียนยาวเกินไป")
    .optional()
    .or(z.literal("")),
  academicPeriodLabel: z
    .string()
    .trim()
    .max(80, "ช่วงการศึกษายาวเกินไป")
    .optional()
    .or(z.literal("")),
  creditHours: z
    .number({ message: "หน่วยกิตต้องเป็นตัวเลข" })
    .min(0, "หน่วยกิตต้องไม่ติดลบ")
    .max(10, "หน่วยกิตเยอะเกินไป")
    .optional(),
});
export type CreateCourseInput = z.infer<typeof CreateCourseSchema>;
