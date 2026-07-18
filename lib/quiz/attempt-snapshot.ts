export type QuizSnapshotOption = {
  id: string;
  text: string;
  isCorrect: boolean;
};

export type QuizSnapshotQuestion = {
  id: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_SELECT" | "TRUE_FALSE";
  prompt: string;
  explanation: string | null;
  points: number;
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
  questions: QuizSnapshotQuestion[];
};

export type StudentQuizAttemptSnapshot = Omit<
  QuizAttemptSnapshot,
  "questions"
> & {
  questions: Array<{
    id: string;
    type: QuizSnapshotQuestion["type"];
    prompt: string;
    points: number;
    options: Array<{ id: string; text: string }>;
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
    questions: snapshot.questions.map((question) => ({
      id: question.id,
      type: question.type,
      prompt: question.prompt,
      points: question.points,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
      })),
    })),
  };
}
