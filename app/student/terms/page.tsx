import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { listStudentLearningResults } from "@/lib/scoring/queries";
import { LearningResultsView } from "@/components/scoring/learning-results-view";
import { StudentTermsShell } from "@/components/scoring/student-terms-shell";

// Auth-gated DB-fetching page — skip static prerender.
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ view?: string }>;
}

export default async function StudentTermsDefaultPage({
  searchParams,
}: PageProps) {
  let session;
  try {
    session = await requireRole(["STUDENT"]);
  } catch {
    redirect("/dashboard");
  }

  const studentUserId = session.user.id;

  const { view: requestedView } = await searchParams;
  const view = requestedView === "archive" ? "archive" : "active";

  const [student, rows] = await Promise.all([
    db.student.findUnique({
      where: { userId: studentUserId },
      select: { firstName: true, lastName: true },
    }),
    listStudentLearningResults(studentUserId),
  ]);
  if (!student) {
    return (
      <StudentTermsShell session={session}>
        <EmptyState>ไม่พบข้อมูลนักเรียน</EmptyState>
      </StudentTermsShell>
    );
  }

  return (
    <StudentTermsShell session={session}>
      <LearningResultsView
        studentName={`${student.firstName} ${student.lastName}`}
        rows={rows}
        view={view}
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
