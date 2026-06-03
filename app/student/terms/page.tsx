import { redirect } from "next/navigation";
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

/**
 * Default landing — picks the current active Term, or the most-recent
 * Term the student has any enrollment in if there is no active term, or
 * an empty state.
 *
 * Linking `/student/terms` (no termId) here keeps the URL shareable and
 * lets the student go straight to "this semester" via nav.
 */
export default async function StudentTermsDefaultPage() {
  let session;
  try {
    session = await requireRole(["STUDENT"]);
  } catch {
    redirect("/dashboard");
  }

  const studentUserId = session.user.id;

  const [student, terms] = await Promise.all([
    db.student.findUnique({
      where: { userId: studentUserId },
      select: { firstName: true, lastName: true, studentId: true },
    }),
    listTermsForStudent(studentUserId),
  ]);
  if (!student) {
    return (
      <StudentTermsShell>
        <EmptyState>ไม่พบข้อมูลนักเรียน</EmptyState>
      </StudentTermsShell>
    );
  }

  if (terms.length === 0) {
    return (
      <StudentTermsShell>
        <EmptyState>
          ยังไม่ได้เข้าร่วมห้องเรียน — ใช้รหัสห้องจากครูที่หน้า{" "}
          <a href="/join" className="underline">
            เข้าร่วมห้องเรียน
          </a>
        </EmptyState>
      </StudentTermsShell>
    );
  }

  const selectedTerm = terms.find((t) => t.isActive) ?? terms[0]!;
  const snapshot = await getStudentTermSnapshot(studentUserId, selectedTerm.id);

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

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="card-flat mx-auto max-w-md p-8 text-center text-sm text-black/60">
      {children}
    </div>
  );
}
