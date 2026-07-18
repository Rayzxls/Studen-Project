import { describe, expect, it } from "vitest";
import {
  toStudentQuizAttemptSnapshot,
  type QuizAttemptSnapshot,
} from "@/lib/quiz/attempt-snapshot";

describe("Student Quiz Attempt snapshot", () => {
  it("never exposes correct answers or explanations to the client payload", () => {
    const serverSnapshot: QuizAttemptSnapshot = {
      quizId: "quiz-1",
      revision: 2,
      title: "แบบทดสอบ",
      description: "เลือกคำตอบ",
      mode: "SCORED",
      hideExplanations: false,
      totalPoints: 1,
      questions: [
        {
          id: "question-1",
          type: "SINGLE_CHOICE",
          prompt: "ข้อใดถูกต้อง",
          explanation: "เฉลยลับ",
          points: 1,
          options: [
            { id: "option-1", text: "A", isCorrect: true },
            { id: "option-2", text: "B", isCorrect: false },
          ],
        },
      ],
    };

    const studentSnapshot = toStudentQuizAttemptSnapshot(serverSnapshot);
    const payload = JSON.stringify(studentSnapshot);

    expect(studentSnapshot.questions[0]).not.toHaveProperty("explanation");
    expect(studentSnapshot.questions[0].options[0]).not.toHaveProperty(
      "isCorrect"
    );
    expect(payload).not.toContain("isCorrect");
    expect(payload).not.toContain("เฉลยลับ");
    expect(serverSnapshot.questions[0].options[0].isCorrect).toBe(true);
  });
});
