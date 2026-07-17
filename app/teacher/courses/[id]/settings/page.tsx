import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { getClassCodeInviteStatus } from "@/lib/course/class-code";
import { listTimetableSlots } from "@/lib/attendance/timetable";
import { CourseShell } from "@/components/course/course-shell";
import { ClassCodeCard } from "@/components/class-code-card";
import { ClassCodeControls } from "@/components/course/class-code-controls";
import { ArchiveCourseDialog } from "@/components/course/archive-course-dialog";
import { TimetableEditor } from "@/components/attendance/timetable-editor";
import { GradeThresholdsCard } from "@/components/scoring/grade-thresholds-card";
import { teacherCourseTabs } from "../_tabs";

// Auth-gated DB-fetching page — skip static prerender.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseSettingsPage({ params }: PageProps) {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;
  const [course, slots] = await Promise.all([
    getCourseOfferingForTeacher(id, session.user.id),
    listTimetableSlots(id),
  ]);
  if (!course) notFound();

  // Invite links + the QR payload must be absolute. If neither explicit env
  // is set, fall back to Vercel's system-provided production domain before
  // localhost — otherwise a missing env var silently ships localhost invite
  // QR codes to students (bare domain, no protocol, per Vercel docs).
  const appUrl = (
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000")
  ).replace(/\/$/, "");
  const inviteStatus = getClassCodeInviteStatus(course);
  const codeExpiresAtLabel = course.codeExpiresAt
    ? new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Bangkok",
      }).format(course.codeExpiresAt)
    : null;

  return (
    <CourseShell
      session={session}
      course={course}
      eyebrow="รายวิชาที่สอน"
      backHref="/teacher/courses"
      tabs={teacherCourseTabs(id)}
    >
      <div className="space-y-4">
        <ClassCodeCard
          classCode={course.classCode}
          courseName={course.name}
          className={course.class.name}
          appUrl={appUrl}
          canJoin={inviteStatus === "READY"}
          inviteStatus={inviteStatus}
          codeExpiresAtLabel={codeExpiresAtLabel}
        />
        <ClassCodeControls
          courseId={id}
          classCode={course.classCode}
          codeActive={course.codeActive}
          codeExpiresAt={course.codeExpiresAt}
        />
        <TimetableEditor courseId={id} slots={slots} />
        <GradeThresholdsCard />
        <ArchiveCourseDialog courseId={id} courseName={course.name} />
      </div>
    </CourseShell>
  );
}
