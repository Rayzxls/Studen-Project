import { RemoveMemberDialog } from "./remove-member-dialog";

const fullDateFmt = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

type Member = {
  id: string;
  enrolledAt: Date;
  student: {
    userId: string;
    studentId: string;
    firstName: string;
    lastName: string;
  };
};

/**
 * Server component — renders the active members table. Each row hosts a
 * <RemoveMemberDialog> client island that opens a modal with the reason
 * textarea + Server Action submission. Keeps the table itself static so
 * the bulk of the markup ships without client JS.
 */
export function MembersTable({
  courseId,
  members,
}: {
  courseId: string;
  members: Member[];
}) {
  if (members.length === 0) {
    return (
      <div className="card p-5">
        <p className="rounded-xl bg-black/[0.04] p-4 text-center text-sm text-black/60">
          ยังไม่มีนักเรียนในห้องนี้ — แชร์รหัสในแท็บ &ldquo;ภาพรวม&rdquo;
          ให้นักเรียนได้เลย
        </p>
      </div>
    );
  }

  return (
    <div className="card p-0">
      <table className="table">
        <thead>
          <tr>
            <th>เลขประจำตัว</th>
            <th>ชื่อ-นามสกุล</th>
            <th>เข้าร่วมเมื่อ</th>
            <th className="w-px text-right">การกระทำ</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const fullName = `${m.student.firstName} ${m.student.lastName}`;
            return (
              <tr key={m.id}>
                <td className="font-mono text-sm">{m.student.studentId}</td>
                <td>{fullName}</td>
                <td className="text-xs text-black/60">
                  {fullDateFmt.format(m.enrolledAt)}
                </td>
                <td className="text-right">
                  <RemoveMemberDialog
                    courseId={courseId}
                    enrollmentId={m.id}
                    studentName={fullName}
                    studentIdNumber={m.student.studentId}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
