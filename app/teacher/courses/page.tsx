import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { listTeacherCourses } from "@/lib/course/enrollment";
import { TopNav } from "@/components/layout/top-nav";
import {
  CourseShowcaseCard,
  CourseShowcaseEmpty,
} from "@/components/dashboard/primitives";

export const dynamic = "force-dynamic";

export default async function TeacherCoursesPage() {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const [courses, me] = await Promise.all([
    listTeacherCourses(session.user.id),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { profileImageId: true },
    }),
  ]);
  const hasAvatar = Boolean(me?.profileImageId);

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
            <div className="badge mb-2">ครูผู้สอน</div>
            <h1
              className="text-3xl font-semibold text-black md:text-4xl"
              style={{ letterSpacing: "-0.03em" }}
            >
              วิชาที่สอน
            </h1>
            <p className="mt-1 text-sm text-black/55">
              จัดการรายวิชา รหัสเข้าห้อง และสมาชิกในรูปแบบการ์ดเดียวกับหน้า
              Dashboard
            </p>
          </div>
          <Link href="/teacher/courses/new" className="btn-primary btn-sm">
            <Plus className="h-4 w-4" aria-hidden="true" />
            สร้างวิชาใหม่
          </Link>
        </div>

        <section className="mt-7">
          {courses.length === 0 ? (
            <CourseShowcaseEmpty
              href="/teacher/courses/new"
              title="ยังไม่มีวิชาที่สอน"
              hint="สร้างวิชาแรก แล้วแชร์รหัสห้องให้นักเรียนเข้าร่วม"
              actionLabel="สร้างวิชา"
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {courses.map((c) => (
                <CourseShowcaseCard
                  key={c.id}
                  href={`/teacher/courses/${c.id}`}
                  title={c.name}
                  subtitle={c.class.name}
                  badge={yearLabelFromTerm(c.term.name)}
                  classId={c.class.id}
                  avatarUserId={session.user.id}
                  hasAvatar={hasAvatar}
                  avatarAlt={`ครู ${c.teacher.firstName} ${c.teacher.lastName}`}
                  notice={
                    c.codeActive ? `รหัส ${c.classCode}` : "ปิดรับนักเรียน"
                  }
                  noticeTone={c.codeActive ? "success" : "muted"}
                  stats={[
                    { value: c._count.enrollments, label: "นักเรียน" },
                    { value: c.creditHours, label: "หน่วยกิต" },
                    { value: c.codeActive ? "เปิด" : "ปิด", label: "รับเข้า" },
                  ]}
                  actionLabel="ดูข้อมูล"
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function yearLabelFromTerm(termName: string): string {
  const year = termName.match(/\d{4}/)?.[0];
  return year ? `ปี ${year}` : termName;
}
