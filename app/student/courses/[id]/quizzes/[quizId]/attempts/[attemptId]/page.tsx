import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CourseShell } from "@/components/course/course-shell";
import { StudentQuizAttempt } from "@/components/quiz/student-quiz-attempt";
import { assert } from "@/lib/auth/guards";
import { getCourseOfferingForStudent } from "@/lib/course/queries";
import { getStudentQuizAttempt, quizCourseEnabled } from "@/lib/quiz";
import { studentCourseTabs } from "../../../../_tabs";
import {
  saveQuizAnswerAction,
  submitQuizAttemptAction,
} from "../../../actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string; quizId: string; attemptId: string }>;
};

export default async function StudentQuizAttemptPage({ params }: PageProps) {
  const { id, quizId, attemptId } = await params;
  if (!quizCourseEnabled(id)) notFound();
  let guard;
  try {
    guard = await assert.isActiveCourseMember(id);
  } catch {
    redirect("/dashboard");
  }
  const store = await cookies();
  const leaseToken = store.get(`beagle-quiz-lease-${attemptId}`)?.value ?? null;
  const [course, attempt] = await Promise.all([
    getCourseOfferingForStudent(id, guard.session.user.id),
    getStudentQuizAttempt(
      { courseOfferingId: id, attemptId, leaseToken },
      { studentUserId: guard.session.user.id }
    ),
  ]);
  if (!course || attempt.quizId !== quizId) notFound();

  return (
    <CourseShell
      session={guard.session}
      course={course}
      eyebrow="กำลังทำแบบทดสอบ"
      backHref="/dashboard"
      tabs={studentCourseTabs(id)}
    >
      <StudentQuizAttempt
        initial={attempt}
        serverNowIso={new Date().toISOString()}
        saveAction={saveQuizAnswerAction}
        submitAction={submitQuizAttemptAction}
      />
    </CourseShell>
  );
}
