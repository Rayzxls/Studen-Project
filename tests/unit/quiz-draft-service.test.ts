import { describe, expect, it, vi } from "vitest";
import {
  createQuizDraft,
  saveQuizDraft,
  type QuizDraftRepository,
} from "@/lib/quiz/draft-service";

const validDraft = {
  courseOfferingId: "course-1",
  lessonId: "lesson-1",
  title: "แบบทดสอบคำศัพท์",
  description: "ทบทวนก่อนเริ่มบทถัดไป",
  mode: "SCORED" as const,
  required: true,
  maxAttempts: 2,
  questions: [
    {
      type: "SINGLE_CHOICE" as const,
      prompt: "คำใดแปลว่าสวัสดี",
      explanation: "Hello เป็นคำทักทาย",
      points: 5,
      fileAttachmentIds: [],
      options: [
        {
          id: "option-a",
          text: "Hello",
          isCorrect: true,
          fileAttachmentIds: [],
        },
        {
          id: "option-b",
          text: "Goodbye",
          isCorrect: false,
          fileAttachmentIds: [],
        },
      ],
    },
  ],
};

function repository(overrides: Partial<QuizDraftRepository> = {}) {
  return {
    createDraft: vi.fn().mockResolvedValue({ id: "quiz-1" }),
    replaceDraft: vi.fn().mockResolvedValue({ id: "quiz-1" }),
    ...overrides,
  } satisfies QuizDraftRepository;
}

const enabledEnv = {
  QUIZ_ENABLED: "1",
  QUIZ_MUTATIONS_ENABLED: "1",
  QUIZ_PILOT_COURSE_IDS: "course-1",
};

describe("Quiz draft service", () => {
  it("fails closed before parsing or touching the repository", async () => {
    const repo = repository();

    await expect(
      createQuizDraft(validDraft, {
        actorUserId: "teacher-1",
        repository: repo,
        env: {},
      })
    ).rejects.toMatchObject({ code: "quiz_mutations_disabled" });

    expect(repo.createDraft).not.toHaveBeenCalled();
  });

  it("normalizes a scored draft and sends its total score atomically", async () => {
    const repo = repository();

    await createQuizDraft(validDraft, {
      actorUserId: "teacher-1",
      repository: repo,
      env: enabledEnv,
    });

    expect(repo.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "teacher-1",
        totalPoints: 5,
        draft: expect.objectContaining({
          title: "แบบทดสอบคำศัพท์",
          mode: "SCORED",
          maxAttempts: 2,
        }),
      })
    );
  });

  it("passes private attachment ids through the validated repository boundary", async () => {
    const repo = repository();

    await createQuizDraft(
      { ...validDraft, id: "quiz-draft-1", fileAttachmentIds: ["file-1"] },
      {
        actorUserId: "teacher-1",
        repository: repo,
        env: enabledEnv,
      }
    );

    expect(repo.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({
          id: "quiz-draft-1",
          fileAttachmentIds: ["file-1"],
        }),
      })
    );
  });

  it("replaces an editable draft through the same validated boundary", async () => {
    const repo = repository();

    await saveQuizDraft("quiz-1", validDraft, {
      actorUserId: "teacher-1",
      repository: repo,
      env: enabledEnv,
    });

    expect(repo.replaceDraft).toHaveBeenCalledWith(
      expect.objectContaining({ quizId: "quiz-1", totalPoints: 5 })
    );
  });
});
