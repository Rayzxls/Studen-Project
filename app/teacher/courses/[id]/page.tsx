import { redirect } from "next/navigation";

/**
 * Teacher CourseOffering landing — Phase 10C made Feed the default course
 * surface (ADR-0025). Opening a course lands the teacher on the chronological
 * Feed; the previous overview content now lives at `/overview` (last tab).
 */
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TeacherCourseIndexPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/teacher/courses/${id}/feed`);
}
