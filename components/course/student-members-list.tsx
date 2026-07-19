import { ShieldCheck, Users } from "lucide-react";
import { UserAvatar } from "@/components/profile/user-avatar";
import {
  colorsForSlot,
  COURSE_SLOT_COUNT,
  type CourseSlot,
} from "@/lib/theme/course-color";

type StudentMember = {
  id: string;
  student: {
    firstName: string;
    lastName: string;
  };
};

type TeacherInfo = {
  userId: string;
  firstName: string;
  lastName: string;
  user: { profileImageId: string | null };
};

/**
 * L1-visibility list of class members for the student-side Members tab.
 *
 * Renders nothing beyond first/last names by construction — the upstream
 * query (`getActiveMembersForStudent`) already strips studentId,
 * enrolledAt, and userId at the DB layer. Initial-letter avatars are
 * derived from the visible name only, tinted by the course identity
 * palette (deterministic per name, ADR-0028 course slots) so the roster
 * reads friendly without exposing any extra data.
 *
 * The teacher block uses the course header's already-public teacher
 * identity (same fields CourseShell renders).
 */
export function StudentMembersList({
  members,
  teacher,
}: {
  members: StudentMember[];
  teacher: TeacherInfo;
}) {
  return (
    <div className="space-y-4">
      {/* ครูผู้สอน */}
      <section className="card p-5 md:p-6">
        <h2
          className="text-base font-medium text-black"
          style={{ letterSpacing: "-0.01em" }}
        >
          ครูผู้สอน
        </h2>
        <div className="panel-inset mt-3 flex items-center gap-3">
          <UserAvatar
            userId={teacher.userId}
            hasImage={teacher.user.profileImageId !== null}
            version={teacher.user.profileImageId}
            size={44}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-black">
              {teacher.firstName} {teacher.lastName}
            </p>
            <p className="text-xs text-black/50">ครูประจำวิชา</p>
          </div>
        </div>
      </section>

      {/* เพื่อนร่วมห้อง */}
      <section className="card p-5 md:p-6">
        <header className="flex items-baseline justify-between gap-3">
          <h2
            className="flex items-center gap-2 text-base font-medium text-black"
            style={{ letterSpacing: "-0.01em" }}
          >
            <Users className="h-4 w-4 text-black/60" aria-hidden="true" />
            เพื่อนร่วมห้อง
          </h2>
          <span className="text-xs text-black/50">{members.length} คน</span>
        </header>

        {members.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-black/15 p-8 text-center">
            <Users
              className="mx-auto h-7 w-7 text-black/25"
              aria-hidden="true"
            />
            <p className="mt-3 text-sm font-medium text-black">
              ยังไม่มีเพื่อนร่วมห้องในวิชานี้
            </p>
            <p className="mt-1 text-xs text-black/50">
              เมื่อเพื่อนเข้าร่วมวิชา รายชื่อจะปรากฏที่นี่
            </p>
          </div>
        ) : (
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {members.map((m) => {
              const fullName = `${m.student.firstName} ${m.student.lastName}`;
              return (
                <li
                  key={m.id}
                  className="flex min-h-11 items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-black/[0.03]"
                >
                  <InitialAvatar name={fullName} />
                  <span className="min-w-0 truncate text-sm text-black">
                    {fullName}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {/* Privacy affordance — L1 visibility made visible (PRODUCT.md
            principle 5): the roster shows names only, by design. */}
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-blue-50 px-3.5 py-2.5 text-xs leading-relaxed text-blue-700">
          <ShieldCheck
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            aria-hidden="true"
          />
          แสดงเฉพาะรายชื่อเท่านั้น — คะแนน การเช็คชื่อ
          และงานของแต่ละคนมองเห็นได้เฉพาะเจ้าของ
        </p>
      </section>
    </div>
  );
}

/**
 * Initial-letter avatar tinted by the 8-slot course identity palette.
 * djb2-style hash over the visible name — deterministic, no extra data.
 */
function InitialAvatar({ name }: { name: string }) {
  let h = 5381;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) + h + name.charCodeAt(i)) | 0;
  }
  const slot = ((h < 0 ? -h : h) % COURSE_SLOT_COUNT) as CourseSlot;
  const colors = colorsForSlot(slot);
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium"
      style={{ backgroundColor: colors.bgTinted, color: colors.text }}
      aria-hidden="true"
    >
      {name.trim().charAt(0)}
    </span>
  );
}
