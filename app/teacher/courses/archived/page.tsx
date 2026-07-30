import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { listArchivedTeacherCourses } from "@/lib/course/enrollment";
import { courseMetadataParts } from "@/lib/course/display";
import { TopNav } from "@/components/layout/top-nav";
import { StudentBottomNav } from "@/components/layout/student-bottom-nav";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function TeacherArchivedCoursesPage() {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const courses = await listArchivedTeacherCourses(session.user.id);

  return (
    <div className="min-h-screen bg-bg">
      <TopNav session={session} />

      <main className="mx-auto max-w-4xl animate-fade-in px-4 py-8 sm:px-6 md:py-10">
        <Link
          href="/teacher/courses"
          className="inline-flex items-center gap-1 text-xs font-medium text-ink-mute transition hover:text-ink hover:no-underline"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          กลับไปวิชาที่สอน
        </Link>

        <div className="mt-5">
          <div className="badge mb-2">เก็บถาวร</div>
          <h1
            className="text-3xl font-semibold text-ink md:text-4xl"
            style={{ letterSpacing: "-0.03em" }}
          >
            วิชาที่ยกเลิกแล้ว
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            วิชาที่ยกเลิกจะถูกซ่อนจาก Dashboard และปิดรหัสเข้าห้อง แต่คะแนน
            งานส่ง และประวัติการเข้าเรียนยังอยู่ครบ
            หน้านี้เก็บไว้เป็นบันทึกว่ายกเลิกอะไรไปเมื่อไร ด้วยเหตุผลใด
          </p>
        </div>

        <section className="mt-7">
          {courses.length === 0 ? (
            <div className="card flex flex-col items-center gap-3 p-10 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-hairline text-ink-mute">
                <Archive className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-sm text-ink-soft">
                ยังไม่มีวิชาที่ยกเลิก — วิชาที่คุณยกเลิกจะมาอยู่ที่นี่
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {courses.map((course) => {
                const metadata = courseMetadataParts(course);
                return (
                  <li key={course.id} className="card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="truncate font-semibold text-ink">
                          {course.name}
                        </h2>
                        {metadata.length > 0 && (
                          <p className="mt-1 text-sm text-ink-mute">
                            {metadata.join(" · ")}
                          </p>
                        )}
                      </div>
                      {course.archivedAt && (
                        <span className="shrink-0 text-xs text-ink-mute">
                          ยกเลิกเมื่อ {dateFormat.format(course.archivedAt)}
                        </span>
                      )}
                    </div>

                    {course.archivedReason && (
                      <p className="mt-3 rounded-xl bg-hairline/60 px-3 py-2 text-sm text-ink-soft">
                        เหตุผล: {course.archivedReason}
                      </p>
                    )}

                    <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-hairline pt-4 text-sm">
                      <div className="flex items-baseline gap-1.5">
                        <dt className="text-ink-mute">นักเรียน</dt>
                        <dd className="font-medium text-ink">
                          {course._count.enrollments}
                        </dd>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <dt className="text-ink-mute">งาน</dt>
                        <dd className="font-medium text-ink">
                          {course._count.assignments}
                        </dd>
                      </div>
                    </dl>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <div className="h-20 md:hidden" />
      </main>

      <StudentBottomNav role="teacher" />
    </div>
  );
}
