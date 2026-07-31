import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { listPastStudentCourses } from "@/lib/course/enrollment";
import { courseMetadataParts } from "@/lib/course/display";
import { TopNav } from "@/components/layout/top-nav";
import { StudentBottomNav } from "@/components/layout/student-bottom-nav";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function StudentPastCoursesPage() {
  let session;
  try {
    session = await requireRole(["STUDENT"]);
  } catch {
    redirect("/dashboard");
  }

  const enrollments = await listPastStudentCourses(session.user.id);

  return (
    <div className="min-h-screen bg-bg">
      <TopNav session={session} />

      <main className="mx-auto max-w-4xl animate-fade-in px-4 py-8 sm:px-6 md:py-10">
        <Link
          href="/student/courses"
          className="inline-flex items-center gap-1 text-xs font-medium text-ink-mute transition hover:text-ink hover:no-underline"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          กลับไปห้องเรียน
        </Link>

        <div className="mt-5">
          <div className="badge mb-2">เก็บถาวร</div>
          <h1
            className="text-3xl font-semibold text-ink md:text-4xl"
            style={{ letterSpacing: "-0.03em" }}
          >
            วิชาที่จบไปแล้ว
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            วิชาที่คุณออกไป และวิชาที่ครูปิดไปแล้ว จะย้ายมาอยู่ที่นี่
            คะแนนและงานที่เคยส่งยังถูกเก็บไว้ครบ
          </p>
        </div>

        <section className="mt-7">
          {enrollments.length === 0 ? (
            <div className="card flex flex-col items-center gap-3 p-10 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-hairline text-ink-mute">
                <Archive className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-sm text-ink-soft">
                ยังไม่มีวิชาที่จบไป — วิชาที่คุณเรียนอยู่ทั้งหมดยังเปิดปกติ
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {enrollments.map((enrollment) => {
                const { course } = enrollment;
                const metadata = courseMetadataParts(course);
                // Three different things end an enrolment and they read very
                // differently: the student left, a teacher removed them, or the
                // whole course was cancelled. Guessing would be worse than
                // silence, so each case says exactly what happened.
                const endedOn = enrollment.removedAt ?? course.archivedAt;
                const endedLabel =
                  enrollment.removedAt === null
                    ? "ครูปิดวิชา"
                    : enrollment.removedById === session.user.id
                      ? "คุณออกจากวิชา"
                      : "ครูนำคุณออกจากห้อง";

                return (
                  <li key={enrollment.id} className="card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="truncate font-semibold text-ink">
                          {course.name}
                        </h2>
                        <p className="mt-1 text-sm text-ink-mute">
                          {[
                            ...metadata,
                            `ครู ${course.teacher.firstName} ${course.teacher.lastName}`,
                          ].join(" · ")}
                        </p>
                      </div>
                      {endedOn && (
                        <span className="shrink-0 text-xs text-ink-mute">
                          {endedLabel}
                          {" · "}
                          {dateFormat.format(endedOn)}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <div className="h-20 md:hidden" />
      </main>

      <StudentBottomNav role="student" />
    </div>
  );
}
