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
  gradeLevel: z.string().trim().min(1, "ระบุระดับชั้น").max(20),
  creditHours: z
    .number({ message: "ระบุหน่วยกิต" })
    .min(0, "หน่วยกิตต้องไม่ติดลบ")
    .max(10, "หน่วยกิตเยอะเกินไป"),
  classId: z.string().min(1, "เลือกห้องเรียน"),
  termId: z.string().min(1, "เลือกเทอม"),
});
export type CreateCourseInput = z.infer<typeof CreateCourseSchema>;
