import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, LogIn } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { listStudentCourses } from "@/lib/course/enrollment";
import { getStudentActionCenter } from "@/lib/dashboard/action-center";
import { TopNav } from "@/components/layout/top-nav";
import { StudentBottomNav } from "@/components/layout/student-bottom-nav";
import {
  CourseShowcaseCard,
  CourseShowcaseEmpty,
} from "@/components/dashboard/primitives";

export const dynamic = "force-dynamic";

export default async function StudentCoursesPage() {
  let session;
  try {
    session = await requireRole(["STUDENT"]);
  } catch {
    redirect("/dashboard");
  }

  const [courses, actionCenter] = await Promise.all([
    listStudentCourses(session.user.id),
    getStudentActionCenter(session.user.id),
  ]);
  const dueByCourse = countBy(actionCenter.due, (item) => item.courseId);
  const returnedByCourse = countBy(
    actionCenter.returned,
    (item) => item.courseId
  );
  const scoreByCourse = countBy(
    actionCenter.recentScores,
    (item) => item.courseId
  );

  return (
    <div className="min-h-screen bg-bg">
      <TopNav session={session} />

      <main className="mx-auto max-w-6xl animate-fade-in px-4 py-8 sm:px-6 md:py-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs font-medium text-black/50 transition hover:text-black hover:no-underline"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          กลับไป Dashboard
        </Link>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="badge mb-2">นักเรียน</div>
            <h1
              className="text-3xl font-semibold text-black md:text-4xl"
              style={{ letterSpacing: "-0.03em" }}
            >
              วิชาเรียน
            </h1>
            <p className="mt-1 text-sm text-black/55">
              รวมทุกวิชาที่เข้าร่วม งานที่ต้องจัดการ และทางเข้าแต่ละห้องเรียน
            </p>
          </div>
          <Link href="/join" className="btn-primary btn-sm">
            <LogIn className="h-4 w-4" aria-hidden="true" />
            เข้าร่วมด้วยรหัส
          </Link>
        </div>

        <section className="mt-7">
          {courses.length === 0 ? (
            <CourseShowcaseEmpty
              href="/join"
              title="ยังไม่มีวิชาเรียน"
              hint="ขอรหัสห้องจากครู แล้วเข้าร่วมเพื่อเริ่มดูงาน คะแนน และประกาศ"
              actionLabel="เข้าร่วมห้องเรียน"
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {courses.map((e) => {
                const courseId = e.course.id;
                const dueCount = dueByCourse.get(courseId) ?? 0;
                const returnedCount = returnedByCourse.get(courseId) ?? 0;
                const needsAction = dueCount + returnedCount;
                return (
                  <CourseShowcaseCard
                    key={e.id}
                    href={`/student/courses/${courseId}`}
                    title={e.course.name}
                    subtitle={e.course.class.name}
                    badge={yearLabelFromTerm(e.course.term.name)}
                    classId={e.course.class.id}
                    avatarUserId={e.course.teacher.userId}
                    hasAvatar={Boolean(e.course.teacher.user.profileImageId)}
                    avatarAlt={`ครู ${e.course.teacher.firstName} ${e.course.teacher.lastName}`}
                    notice={
                      needsAction > 0
                        ? `มีงานต้องจัดการ ${needsAction} ชิ้น`
                        : `ครู ${e.course.teacher.firstName} ${e.course.teacher.lastName}`
                    }
                    noticeTone={needsAction > 0 ? "attention" : "muted"}
                    stats={[
                      { value: dueCount, label: "งานต้องส่ง" },
                      {
                        value: scoreByCourse.get(courseId) ?? 0,
                        label: "คะแนน",
                      },
                      { value: e.course.creditHours, label: "หน่วยกิต" },
                    ]}
                    actionLabel="เข้าวิชา"
                  />
                );
              })}
            </div>
          )}
        </section>
        <div className="h-20 md:hidden" />
      </main>

      <StudentBottomNav />
    </div>
  );
}

function countBy<T>(
  items: T[],
  getKey: (item: T) => string
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function yearLabelFromTerm(termName: string): string {
  const year = termName.match(/\d{4}/)?.[0];
  return year ? `ปี ${year}` : termName;
}
