import { z } from "zod";

export const QUIZ_TITLE_MAX = 200;
export const QUIZ_TEXT_MAX = 5_000;
export const QUIZ_QUESTION_MAX = 100;
export const QUIZ_OPTION_MIN = 2;
export const QUIZ_OPTION_MAX = 10;
export const QUIZ_POINT_MIN = 1;
export const QUIZ_POINT_MAX = 1_000;
export const QUIZ_TIME_LIMIT_MAX_MINUTES = 24 * 60;
export const QUIZ_SCORED_ATTEMPT_MAX = 10;
export const QUIZ_ATTACHMENT_MAX = 10;
export const QUIZ_OPTION_ATTACHMENT_MAX = 5;
export const QUIZ_REASON_MIN = 5;
export const QUIZ_REASON_MAX = 500;

const attachmentIds = (max: number) =>
  z
    .array(z.string().trim().min(1))
    .max(max)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "ไฟล์แนบซ้ำกัน",
    });

const nullableText = z
  .string()
  .trim()
  .max(QUIZ_TEXT_MAX)
  .transform((value) => (value.length === 0 ? null : value));

export const QuizReasonSchema = z
  .string()
  .trim()
  .min(QUIZ_REASON_MIN)
  .max(QUIZ_REASON_MAX);

export const QuizOptionSchema = z.object({
  id: z.string().trim().min(1),
  text: z.string().trim().min(1).max(QUIZ_TEXT_MAX),
  isCorrect: z.boolean(),
  fileAttachmentIds: attachmentIds(QUIZ_OPTION_ATTACHMENT_MAX).default([]),
});

export const QuizQuestionSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    type: z.enum(["SINGLE_CHOICE", "MULTIPLE_SELECT", "TRUE_FALSE"]),
    prompt: z.string().trim().min(1).max(QUIZ_TEXT_MAX),
    explanation: nullableText.optional().default(null),
    points: z.int().min(QUIZ_POINT_MIN).max(QUIZ_POINT_MAX),
    fileAttachmentIds: attachmentIds(QUIZ_ATTACHMENT_MAX).default([]),
    options: z
      .array(QuizOptionSchema)
      .min(QUIZ_OPTION_MIN)
      .max(QUIZ_OPTION_MAX),
  })
  .superRefine((question, context) => {
    const optionIds = question.options.map((option) => option.id);
    if (new Set(optionIds).size !== optionIds.length) {
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "รหัสตัวเลือกซ้ำกัน",
      });
    }

    const correctCount = question.options.filter(
      (option) => option.isCorrect
    ).length;
    if (question.type === "SINGLE_CHOICE" && correctCount !== 1) {
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "คำถามแบบเลือกคำตอบเดียวต้องมีคำตอบถูก 1 ข้อ",
      });
    }
    if (question.type === "MULTIPLE_SELECT" && correctCount < 2) {
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "คำถามแบบเลือกหลายคำตอบต้องมีคำตอบถูกอย่างน้อย 2 ข้อ",
      });
    }
    if (
      question.type === "TRUE_FALSE" &&
      (question.options.length !== 2 || correctCount !== 1)
    ) {
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "คำถามจริงหรือเท็จต้องมี 2 ตัวเลือกและคำตอบถูก 1 ข้อ",
      });
    }
  });

export const CreateQuizDraftSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    courseOfferingId: z.string().trim().min(1),
    lessonId: z.string().trim().min(1),
    title: z.string().trim().min(1).max(QUIZ_TITLE_MAX),
    description: nullableText.optional().default(null),
    mode: z.enum(["PRACTICE", "SCORED"]),
    required: z.boolean().default(false),
    opensAt: z.coerce.date().nullable().optional().default(null),
    closesAt: z.coerce.date().nullable().optional().default(null),
    timeLimitMinutes: z
      .int()
      .min(1)
      .max(QUIZ_TIME_LIMIT_MAX_MINUTES)
      .nullable()
      .optional()
      .default(null),
    maxAttempts: z
      .int()
      .min(1)
      .max(QUIZ_SCORED_ATTEMPT_MAX)
      .nullable()
      .optional()
      .default(null),
    passThresholdPercent: z
      .int()
      .min(0)
      .max(100)
      .nullable()
      .optional()
      .default(null),
    shuffleQuestions: z.boolean().default(false),
    shuffleOptions: z.boolean().default(false),
    hideExplanations: z.boolean().default(false),
    fileAttachmentIds: attachmentIds(QUIZ_ATTACHMENT_MAX).default([]),
    questions: z.array(QuizQuestionSchema).min(1).max(QUIZ_QUESTION_MAX),
  })
  .superRefine((quiz, context) => {
    if (
      quiz.opensAt !== null &&
      quiz.closesAt !== null &&
      quiz.opensAt.getTime() >= quiz.closesAt.getTime()
    ) {
      context.addIssue({
        code: "custom",
        path: ["closesAt"],
        message: "เวลาปิดต้องอยู่หลังเวลาเปิด",
      });
    }
  })
  .transform((quiz) => ({
    ...quiz,
    maxAttempts:
      quiz.mode === "SCORED" ? (quiz.maxAttempts ?? 1) : quiz.maxAttempts,
  }));

export const QuizAttemptAnswerSchema = z.object({
  questionId: z.string().trim().min(1),
  selectedOptionIds: z
    .array(z.string().trim().min(1))
    .max(QUIZ_OPTION_MAX)
    .refine((ids) => new Set(ids).size === ids.length),
  expectedRevision: z.int().min(0),
  leaseVersion: z.int().min(1),
  idempotencyKey: z.string().trim().min(1).max(128),
});

export const QuizStudentExceptionSchema = z
  .object({
    enrollmentId: z.string().trim().min(1),
    extendedDeadline: z.coerce.date().nullable().optional().default(null),
    extraAttempts: z.int().min(0).max(QUIZ_SCORED_ATTEMPT_MAX).default(0),
    reason: QuizReasonSchema,
  })
  .refine(
    (value) => value.extendedDeadline !== null || value.extraAttempts > 0,
    { message: "ต้องขยายเวลาหรือเพิ่มจำนวนครั้งอย่างน้อย 1 อย่าง" }
  );

export const ReopenQuizSchema = z.object({
  newClosesAt: z.coerce.date(),
  reason: QuizReasonSchema,
});

export const PublishQuizResultsSchema = z.object({
  missingStudentsConfirmed: z.boolean(),
});

export type CreateQuizDraftInput = z.input<typeof CreateQuizDraftSchema>;
export type CreateQuizDraftData = z.output<typeof CreateQuizDraftSchema>;
export type QuizAttemptAnswerInput = z.input<typeof QuizAttemptAnswerSchema>;
export type QuizStudentExceptionInput = z.input<
  typeof QuizStudentExceptionSchema
>;
export type ReopenQuizInput = z.input<typeof ReopenQuizSchema>;
export type PublishQuizResultsInput = z.input<typeof PublishQuizResultsSchema>;
