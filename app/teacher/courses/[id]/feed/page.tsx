import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { getCourseFeed } from "@/lib/feed/aggregator";
import { CourseShell } from "@/components/course/course-shell";
import {
  CourseFeedView,
  feedKindsForFilter,
  type CourseFeedFilter,
} from "@/components/feed/course-feed-view";
import { UnifiedComposer } from "@/components/feed/unified-composer";
import { teacherCourseTabs } from "../_tabs";
import {
  getLessonWorkspaceForViewer,
  lessonWorkspaceEnabled,
  lessonWorkspaceMutationsEnabled,
} from "@/lib/lesson";

// Auth-gated DB-fetching page — skip static prerender.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}

export default async function TeacherCourseFeedPage({
  params,
  searchParams,
}: PageProps) {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }
  const { id } = await params;
  const { type } = await searchParams;

  const course = await getCourseOfferingForTeacher(id, session.user.id);
  if (!course) notFound();

  const filter = normalizeFilter(type);
  const kindFilter = feedKindsForFilter(filter);
  const page = await getCourseFeed(id, undefined, kindFilter ?? undefined);
  const lessonWorkspace = lessonWorkspaceEnabled()
    ? await getLessonWorkspaceForViewer({
        courseOfferingId: id,
        viewer: { id: session.user.id, role: session.user.role },
      })
    : null;
  const lessonOptions =
    lessonWorkspace?.lessons
      .filter((lesson) => lesson.state === "ACTIVE")
      .map((lesson) => ({ id: lesson.id, title: lesson.title })) ?? [];

  return (
    <CourseShell
      session={session}
      course={course}
      eyebrow="รายวิชาที่สอน"
      backHref="/teacher/courses"
      tabs={teacherCourseTabs(id)}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-end">
          <UnifiedComposer
            courseId={id}
            lessonOptions={lessonOptions}
            requireLesson={lessonWorkspaceMutationsEnabled()}
          />
        </div>
        <CourseFeedView
          items={page.items}
          courseId={id}
          role="TEACHER"
          filter={filter}
        />
      </div>
    </CourseShell>
  );
}

function normalizeFilter(raw: string | undefined): CourseFeedFilter {
  if (
    raw === "announcement" ||
    raw === "assignment" ||
    raw === "material" ||
    raw === "score"
  )
    return raw;
  return "all";
}
