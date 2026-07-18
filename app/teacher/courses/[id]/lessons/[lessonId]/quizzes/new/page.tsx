import { notFound, redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
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
  const quizDraftId = draftOwnerId(id);

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
          id: quizDraftId,
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
          attachments: [],
          questions: [
            {
              id: draftOwnerId(id),
              type: "SINGLE_CHOICE",
              prompt: "",
              explanation: "",
              points: 1,
              attachments: [],
              options: [
                {
                  id: draftOwnerId(id),
                  text: "",
                  isCorrect: true,
                  attachments: [],
                },
                {
                  id: draftOwnerId(id),
                  text: "",
                  isCorrect: false,
                  attachments: [],
                },
              ],
            },
          ],
        }}
      />
    </CourseShell>
  );
}

function draftOwnerId(courseOfferingId: string): string {
  return `${courseOfferingId}_d_${randomBytes(12).toString("hex")}`;
}
