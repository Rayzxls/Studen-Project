import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { listTimetableSlots } from "@/lib/attendance/timetable";
import { CourseShell } from "@/components/course/course-shell";
import { ClassCodeControls } from "@/components/course/class-code-controls";
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

  return (
    <CourseShell
      course={course}
      eyebrow="รายวิชาที่สอน"
      backHref="/teacher/courses"
      tabs={teacherCourseTabs(id)}
    >
      <div className="space-y-4">
        <ClassCodeControls
          courseId={id}
          classCode={course.classCode}
          codeActive={course.codeActive}
          codeExpiresAt={course.codeExpiresAt}
        />
        <TimetableEditor courseId={id} slots={slots} />
        <GradeThresholdsCard />
      </div>
    </CourseShell>
  );
}
