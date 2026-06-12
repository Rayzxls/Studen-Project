import Link from "next/link";
import { getActiveMembers } from "@/lib/course/enrollment";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

const fullDateFmt = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  timeZone: "Asia/Bangkok",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AdminCourseMembersPage({ params }: PageProps) {
  const { id } = await params;
  const members = await getActiveMembers(id);

  if (members.length === 0) {
    return (
      <div className="card p-5">
        <p className="rounded-xl bg-black/[0.04] p-4 text-center text-sm text-ink-soft">
          ยังไม่มีนักเรียนในรายวิชานี้
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
            <th>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id}>
              <td className="font-mono text-sm">{member.student.studentId}</td>
              <td>
                <Link
                  href={`/admin/users/${member.student.userId}`}
                  className="font-medium text-black hover:underline"
                >
                  {member.student.firstName} {member.student.lastName}
                </Link>
              </td>
              <td className="text-xs text-ink-soft">
                {fullDateFmt.format(member.enrolledAt)}
              </td>
              <td>
                <Link
                  href={`/admin/users/${member.student.userId}`}
                  className="btn-ghost btn-sm"
                >
                  ดูข้อมูล
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
