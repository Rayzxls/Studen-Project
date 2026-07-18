import { describe, expect, it } from "vitest";
import {
  CreateQuizDraftSchema,
  QuizAttemptAnswerSchema,
  QuizQuestionSchema,
} from "@/lib/quiz/validation";

const option = (id: string, isCorrect: boolean) => ({
  id,
  text: `ตัวเลือก ${id}`,
  isCorrect,
  fileAttachmentIds: [],
});

describe("Quiz validation", () => {
  it("accepts a valid scored draft and computes no hidden defaults", () => {
    const parsed = CreateQuizDraftSchema.parse({
      courseOfferingId: "course-1",
      lessonId: "lesson-1",
      title: "แบบทดสอบคำศัพท์",
      description: "",
      mode: "SCORED",
      required: true,
      maxAttempts: 2,
      questions: [
        {
          type: "SINGLE_CHOICE",
          prompt: "คำใดแปลว่าสวัสดี",
          points: 5,
          explanation: "Greeting",
          fileAttachmentIds: [],
          options: [option("a", true), option("b", false)],
        },
      ],
    });
    expect(parsed.description).toBeNull();
    expect(parsed.questions).toHaveLength(1);
  });

  it("requires exactly one correct answer for single choice", () => {
    expect(
      QuizQuestionSchema.safeParse({
        type: "SINGLE_CHOICE",
        prompt: "เลือกคำตอบ",
        points: 1,
        fileAttachmentIds: [],
        options: [option("a", true), option("b", true)],
      }).success
    ).toBe(false);
  });

  it("requires at least two correct answers for multiple select", () => {
    expect(
      QuizQuestionSchema.safeParse({
        type: "MULTIPLE_SELECT",
        prompt: "เลือกทุกข้อที่ถูก",
        points: 2,
        fileAttachmentIds: [],
        options: [option("a", true), option("b", false)],
      }).success
    ).toBe(false);
  });

  it("enforces question, option, point, and attachment limits", () => {
    expect(
      QuizQuestionSchema.safeParse({
        type: "TRUE_FALSE",
        prompt: "จริงหรือเท็จ",
        points: 1001,
        fileAttachmentIds: Array.from({ length: 11 }, (_, i) => `file-${i}`),
        options: [option("true", true), option("false", false)],
      }).success
    ).toBe(false);
  });

  it("validates optimistic answer writes", () => {
    expect(
      QuizAttemptAnswerSchema.safeParse({
        questionId: "question-1",
        selectedOptionIds: ["option-1"],
        expectedRevision: 3,
        leaseVersion: 2,
        idempotencyKey: "request-123",
      }).success
    ).toBe(true);
    expect(
      QuizAttemptAnswerSchema.safeParse({
        questionId: "question-1",
        selectedOptionIds: [],
        expectedRevision: -1,
        leaseVersion: 0,
        idempotencyKey: "",
      }).success
    ).toBe(false);
  });
});
