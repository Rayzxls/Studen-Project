import { notFound, redirect } from "next/navigation";
import { CourseShell } from "@/components/course/course-shell";
import { TeacherQuizBuilder } from "@/components/quiz/teacher-quiz-builder";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { getTeacherLessonDetail } from "@/lib/lesson";
import { quizCourseEnabled, quizCourseMutationsEnabled } from "@/lib/quiz";
import { teacherCourseTabs } from "../../../../_tabs";
import { createQuizDraftAction } from "../../../../quizzes/actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string; lessonId: string }>;
  searchParams: Promise<{ notice?: string }>;
};

export default async function NewTeacherQuizPage({
  params,
  searchParams,
}: PageProps) {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const { id, lessonId } = await params;
  if (!quizCourseEnabled(id) || !quizCourseMutationsEnabled(id)) notFound();
  const { notice } = await searchParams;
  const [course, lesson] = await Promise.all([
    getCourseOfferingForTeacher(id, session.user.id),
    getTeacherLessonDetail({
      courseOfferingId: id,
      lessonId,
      teacherId: session.user.id,
    }),
  ]);
  if (!course || lesson.state !== "ACTIVE") notFound();

  return (
    <CourseShell
      session={session}
      course={course}
      eyebrow="รายวิชาที่สอน"
      backHref="/teacher/courses"
      tabs={teacherCourseTabs(id)}
    >
      <TeacherQuizBuilder
        action={createQuizDraftAction}
        notice={notice}
        initial={{
          courseOfferingId: id,
          lessonId,
          lessonTitle: lesson.title,
          title: "",
          description: "",
          mode: "PRACTICE",
          required: false,
          opensAt: "",
          closesAt: "",
          timeLimitMinutes: null,
          maxAttempts: null,
          passThresholdPercent: null,
          shuffleQuestions: false,
          shuffleOptions: false,
          hideExplanations: false,
          questions: [
            {
              id: "new-question-1",
              type: "SINGLE_CHOICE",
              prompt: "",
              explanation: "",
              points: 1,
              options: [
                { id: "new-option-1", text: "", isCorrect: true },
                { id: "new-option-2", text: "", isCorrect: false },
              ],
            },
          ],
        }}
      />
    </CourseShell>
  );
}
