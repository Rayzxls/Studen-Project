import { z } from "zod";

export const LESSON_TITLE_MAX = 120;
export const LESSON_DESCRIPTION_MAX = 1_000;
export const LESSON_REASON_MIN = 5;
export const LESSON_REASON_MAX = 500;

const title = z
  .string()
  .trim()
  .min(1, "ตั้งชื่อบทเรียน")
  .max(LESSON_TITLE_MAX, "ชื่อบทเรียนยาวเกินไป");

const description = z
  .string()
  .trim()
  .max(LESSON_DESCRIPTION_MAX, "คำอธิบายยาวเกินไป")
  .transform((value) => (value.length === 0 ? null : value));

export const LessonReasonSchema = z
  .string()
  .trim()
  .min(LESSON_REASON_MIN, `ระบุเหตุผลอย่างน้อย ${LESSON_REASON_MIN} ตัวอักษร`)
  .max(LESSON_REASON_MAX, `เหตุผลต้องไม่เกิน ${LESSON_REASON_MAX} ตัวอักษร`);

export const CreateLessonSchema = z.object({
  courseOfferingId: z.string().min(1),
  title,
  description: description.optional().default(null),
});

export const UpdateLessonSchema = z
  .object({
    title: title.optional(),
    description: description.optional(),
  })
  .refine(
    (value) => value.title !== undefined || value.description !== undefined,
    { message: "ไม่มีข้อมูลที่ต้องแก้ไข" }
  );

export const ReorderLessonsSchema = z.object({
  courseOfferingId: z.string().min(1),
  lessonIds: z.array(z.string().min(1)).min(1),
});

export const MoveLessonContentSchema = z.object({
  contentType: z.enum(["ASSIGNMENT", "MATERIAL"]),
  contentId: z.string().min(1),
  targetLessonId: z.string().min(1),
  reason: LessonReasonSchema,
});

export type CreateLessonInput = z.input<typeof CreateLessonSchema>;
export type UpdateLessonInput = z.input<typeof UpdateLessonSchema>;
export type ReorderLessonsInput = z.input<typeof ReorderLessonsSchema>;
export type MoveLessonContentInput = z.input<typeof MoveLessonContentSchema>;
