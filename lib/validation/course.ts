import { z } from "zod";

export const JoinSchema = z.object({
  code: z.string().min(3).max(32),
});
export type JoinInput = z.infer<typeof JoinSchema>;

export const CreateCourseSchema = z.object({
  subjectId: z.string().min(1, "เลือกวิชา"),
  classId: z.string().min(1, "เลือกห้องเรียน"),
  termId: z.string().min(1, "เลือกเทอม"),
});
export type CreateCourseInput = z.infer<typeof CreateCourseSchema>;
