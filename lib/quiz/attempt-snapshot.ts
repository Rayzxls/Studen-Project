export type QuizSnapshotAttachment = {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
};

export type QuizSnapshotOption = {
  id: string;
  text: string;
  isCorrect: boolean;
  attachments: QuizSnapshotAttachment[];
};

export type QuizSnapshotQuestion = {
  id: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_SELECT" | "TRUE_FALSE";
  prompt: string;
  explanation: string | null;
  points: number;
  attachments: QuizSnapshotAttachment[];
  options: QuizSnapshotOption[];
};

export type QuizAttemptSnapshot = {
  quizId: string;
  revision: number;
  title: string;
  description: string | null;
  mode: "PRACTICE" | "SCORED";
  hideExplanations: boolean;
  totalPoints: number;
  attachments: QuizSnapshotAttachment[];
  questions: QuizSnapshotQuestion[];
};

export function filterVisibleQuizAttachments<T extends { id: string }>(
  attachments: ReadonlyArray<T>,
  restrictedIds: ReadonlySet<string>
): T[] {
  return attachments.filter((attachment) => !restrictedIds.has(attachment.id));
}

export type StudentQuizAttemptSnapshot = Omit<
  QuizAttemptSnapshot,
  "questions"
> & {
  questions: Array<{
    id: string;
    type: QuizSnapshotQuestion["type"];
    prompt: string;
    points: number;
    attachments: QuizSnapshotAttachment[];
    options: Array<{
      id: string;
      text: string;
      attachments: QuizSnapshotAttachment[];
    }>;
  }>;
};

export function toStudentQuizAttemptSnapshot(
  snapshot: QuizAttemptSnapshot
): StudentQuizAttemptSnapshot {
  return {
    quizId: snapshot.quizId,
    revision: snapshot.revision,
    title: snapshot.title,
    description: snapshot.description,
    mode: snapshot.mode,
    hideExplanations: snapshot.hideExplanations,
    totalPoints: snapshot.totalPoints,
    attachments: snapshot.attachments ?? [],
    questions: snapshot.questions.map((question) => ({
      id: question.id,
      type: question.type,
      prompt: question.prompt,
      points: question.points,
      attachments: question.attachments ?? [],
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
        attachments: option.attachments ?? [],
      })),
    })),
  };
}
