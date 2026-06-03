import { Users } from "lucide-react";

type StudentMember = {
  id: string;
  student: {
    firstName: string;
    lastName: string;
  };
};

/**
 * L1-visibility list of class members for the student-side Members tab.
 *
 * Renders nothing beyond first/last names by construction — the upstream
 * query (`getActiveMembersForStudent`) already strips studentId,
 * enrolledAt, and userId at the DB layer. This component does not need
 * defensive checks because the type signature can't carry forbidden fields.
 */
export function StudentMembersList({ members }: { members: StudentMember[] }) {
  if (members.length === 0) {
    return (
      <div className="card p-5">
        <p className="rounded-xl bg-black/[0.04] p-4 text-center text-sm text-black/60">
          ยังไม่มีเพื่อนร่วมห้องในวิชานี้
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <header className="mb-4 flex items-center gap-2">
        <Users className="h-4 w-4 text-black/60" />
        <h2
          className="font-medium text-black"
          style={{ letterSpacing: "-0.02em" }}
        >
          เพื่อนร่วมห้อง ({members.length} คน)
        </h2>
      </header>

      <ul className="grid gap-2 text-sm text-black sm:grid-cols-2">
        {members.map((m) => (
          <li
            key={m.id}
            className="rounded-xl bg-black/[0.02] px-3 py-2 transition-colors hover:bg-black/[0.04]"
          >
            {m.student.firstName} {m.student.lastName}
          </li>
        ))}
      </ul>
    </div>
  );
}
