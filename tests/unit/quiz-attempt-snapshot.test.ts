import { describe, expect, it } from "vitest";
import {
  filterVisibleQuizAttachments,
  toStudentQuizAttemptSnapshot,
  type QuizAttemptSnapshot,
} from "@/lib/quiz/attempt-snapshot";

describe("Student Quiz Attempt snapshot", () => {
  it("removes moderated attachments before an attempt snapshot is created", () => {
    const attachments = [
      { id: "visible-file", originalFilename: "visible.png" },
      { id: "restricted-file", originalFilename: "restricted.png" },
    ];

    expect(
      filterVisibleQuizAttachments(attachments, new Set(["restricted-file"]))
    ).toEqual([attachments[0]]);
  });

  it("never exposes correct answers or explanations to the client payload", () => {
    const serverSnapshot: QuizAttemptSnapshot = {
      quizId: "quiz-1",
      revision: 2,
      title: "แบบทดสอบ",
      description: "เลือกคำตอบ",
      mode: "SCORED",
      hideExplanations: false,
      totalPoints: 1,
      attachments: [
        {
          id: "quiz-file",
          originalFilename: "instructions.pdf",
          mimeType: "application/pdf",
          sizeBytes: 128,
        },
      ],
      questions: [
        {
          id: "question-1",
          type: "SINGLE_CHOICE",
          prompt: "ข้อใดถูกต้อง",
          explanation: "เฉลยลับ",
          points: 1,
          attachments: [],
          options: [
            {
              id: "option-1",
              text: "A",
              isCorrect: true,
              attachments: [],
            },
            {
              id: "option-2",
              text: "B",
              isCorrect: false,
              attachments: [],
            },
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
    expect(studentSnapshot.attachments[0]?.originalFilename).toBe(
      "instructions.pdf"
    );
    expect(serverSnapshot.questions[0].options[0].isCorrect).toBe(true);
  });

  it("keeps legacy snapshots without attachment arrays readable", () => {
    const legacy = {
      quizId: "legacy-quiz",
      revision: 1,
      title: "Legacy",
      description: null,
      mode: "PRACTICE",
      hideExplanations: true,
      totalPoints: 1,
      questions: [
        {
          id: "question-1",
          type: "SINGLE_CHOICE",
          prompt: "Legacy question",
          explanation: null,
          points: 1,
          options: [
            { id: "option-1", text: "A", isCorrect: true },
            { id: "option-2", text: "B", isCorrect: false },
          ],
        },
      ],
    } as unknown as QuizAttemptSnapshot;

    const studentSnapshot = toStudentQuizAttemptSnapshot(legacy);

    expect(studentSnapshot.attachments).toEqual([]);
    expect(studentSnapshot.questions[0]?.attachments).toEqual([]);
    expect(studentSnapshot.questions[0]?.options[0]?.attachments).toEqual([]);
  });
});
