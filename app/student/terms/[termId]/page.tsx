import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import {
  getStudentTermSnapshot,
  listTermsForStudent,
} from "@/lib/scoring/queries";
import { TermSummaryView } from "@/components/scoring/term-summary-view";
import { StudentTermsShell } from "@/components/scoring/student-terms-shell";

// Auth-gated DB-fetching page — skip static prerender.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ termId: string }>;
}

/**
 * Specific term view — accessed from the history dropdown on the default
 * page. We re-validate that the student is allowed to view this term
 * (must have any enrollment, active OR removed). Removed-enrollment Terms
 * still show up in the list — the live GPA filters back down to active.
 */
export default async function StudentTermPage({ params }: PageProps) {
  let session;
  try {
    session = await requireRole(["STUDENT"]);
  } catch {
    redirect("/dashboard");
  }
  const { termId } = await params;
  const studentUserId = session.user.id;

  const [student, terms] = await Promise.all([
    db.student.findUnique({
      where: { userId: studentUserId },
      select: { firstName: true, lastName: true, studentId: true },
    }),
    listTermsForStudent(studentUserId),
  ]);
  if (!student) redirect("/dashboard");

  const selectedTerm = terms.find((t) => t.id === termId);
  if (!selectedTerm) notFound();

  const snapshot = await getStudentTermSnapshot(studentUserId, termId);

  return (
    <StudentTermsShell>
      <TermSummaryView
        studentName={`${student.firstName} ${student.lastName}`}
        studentIdNumber={student.studentId}
        selectedTerm={selectedTerm}
        allTerms={terms}
        rows={snapshot.rows}
        bundles={snapshot.bundles}
      />
    </StudentTermsShell>
  );
}
