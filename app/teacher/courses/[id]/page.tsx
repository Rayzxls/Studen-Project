import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, ClipboardCheck, ClipboardList, Users } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { getActiveMembers } from "@/lib/course/enrollment";
import { db } from "@/lib/db/client";
import { SubmissionStatus } from "@prisma/client";
import { ClassCodeCard } from "@/components/class-code-card";
import { CourseShell } from "@/components/course/course-shell";
import { AnimatedStat } from "@/components/dashboard/animated-stat";
import { teacherCourseTabs } from "./_tabs";

// Auth-gated DB-fetching page — skip static prerender.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseOverviewPage({ params }: PageProps) {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;
  const course = await getCourseOfferingForTeacher(id, session.user.id);
  if (!course) notFound();

  // Active member count — Members tab owns the full list now (P3-5/2).
  const [activeMembers, ungradedSubmissions, assignmentCount] =
    await Promise.all([
      getActiveMembers(id),
      db.submission.count({
        where: {
          assignment: { courseOfferingId: id, isScored: true },
          status: {
            in: [SubmissionStatus.SUBMITTED, SubmissionStatus.LATE_SUBMITTED],
          },
        },
      }),
      db.assignment.count({ where: { courseOfferingId: id } }),
    ]);

  return (
    <CourseShell
      session={session}
      course={course}
      eyebrow="รายวิชาที่สอน"
      backHref="/teacher/courses"
      tabs={teacherCourseTabs(id)}
    >
      <div className="space-y-6">
        {/* Teacher KPI strip — three .card-tinted tiles for at-a-glance
            status. Tones: members = blue (info), งานรอตรวจ = orange when
            > 0 else neutral, การบ้านในห้อง = blue. */}
        <div className="grid gap-4 md:grid-cols-3">
          <Link
            href={`/teacher/courses/${id}/members`}
            className="card-tinted card-tinted-blue group block p-5 hover:no-underline"
          >
            <p className="flex items-center gap-1.5 text-xs font-medium opacity-80">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              สมาชิก
            </p>
            <p
              className="mt-2 text-3xl font-semibold"
              style={{ letterSpacing: "-0.02em" }}
            >
              <AnimatedStat value={activeMembers.length} />
              <span className="ml-1 text-base font-medium opacity-60">คน</span>
            </p>
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] opacity-80">
              ดูทั้งหมด
              <ArrowRight
                className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </p>
          </Link>

          <Link
            href={`/teacher/courses/${id}/assignments`}
            className={
              (ungradedSubmissions > 0
                ? "card-tinted card-tinted-orange"
                : "card") + " group block p-5 hover:no-underline"
            }
          >
            <p
              className={
                "flex items-center gap-1.5 text-xs font-medium " +
                (ungradedSubmissions > 0 ? "opacity-80" : "text-black/50")
              }
            >
              <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
              งานรอตรวจ
            </p>
            <p
              className={
                "mt-2 text-3xl font-semibold " +
                (ungradedSubmissions === 0 ? "text-black" : "")
              }
              style={{ letterSpacing: "-0.02em" }}
            >
              <AnimatedStat value={ungradedSubmissions} />
              <span
                className={
                  "ml-1 text-base font-medium " +
                  (ungradedSubmissions > 0 ? "opacity-60" : "text-black/40")
                }
              >
                ชิ้น
              </span>
            </p>
            <p
              className={
                "mt-1 text-[11px] " +
                (ungradedSubmissions > 0 ? "opacity-80" : "text-black/50")
              }
            >
              {ungradedSubmissions === 0
                ? "ตรวจครบแล้ว"
                : "ส่งแล้ว · รอครูตรวจ"}
            </p>
          </Link>

          <Link
            href={`/teacher/courses/${id}/assignments`}
            className="card-tinted card-tinted-blue group block p-5 hover:no-underline"
          >
            <p className="flex items-center gap-1.5 text-xs font-medium opacity-80">
              <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
              การบ้านในห้อง
            </p>
            <p
              className="mt-2 text-3xl font-semibold"
              style={{ letterSpacing: "-0.02em" }}
            >
              <AnimatedStat value={assignmentCount} />
              <span className="ml-1 text-base font-medium opacity-60">
                รายการ
              </span>
            </p>
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] opacity-80">
              ดูรายการ
              <ArrowRight
                className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </p>
          </Link>
        </div>

        <ClassCodeCard
          classCode={course.classCode}
          courseName={course.name}
          className={course.class.name}
        />
      </div>
    </CourseShell>
  );
}
