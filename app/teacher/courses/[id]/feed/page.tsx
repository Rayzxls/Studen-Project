import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import {
  courseHasTimetableSlot,
  getCourseOfferingForTeacher,
} from "@/lib/course/queries";
import { getCourseFeed } from "@/lib/feed/aggregator";
import { CourseShell } from "@/components/course/course-shell";
import { TimetableSetupHint } from "@/components/course/timetable-setup-hint";
import { GuideTourMount } from "@/components/guide/guide-tour-mount";
import { shouldShowTour } from "@/lib/guide/completion";
import { tourById } from "@/lib/guide/tours";
import { markGuideTourSeenAction } from "@/app/dashboard/guide-actions";
import {
  CourseFeedView,
  feedKindsForFilter,
  type CourseFeedFilter,
} from "@/components/feed/course-feed-view";
import { UnifiedComposer } from "@/components/feed/unified-composer";
import { PublishingQueueBanner } from "@/components/publishing/teacher-publishing-schedule";
import { getPublishingQueueSummary } from "@/lib/publishing/teacher-schedule";
import { teacherCourseTabs } from "../_tabs";
import {
  getLessonWorkspaceForViewer,
  lessonWorkspaceCourseEnabled,
  lessonWorkspaceCourseMutationsEnabled,
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
  const [page, hasTimetable, showSetupGuide, publishingQueue] =
    await Promise.all([
      getCourseFeed(id, "AUTHOR", undefined, kindFilter ?? undefined),
      courseHasTimetableSlot(id),
      shouldShowTour({
        userId: session.user.id,
        tourId: "teacher-course",
        eligible: true,
      }),
      getPublishingQueueSummary(id),
    ]);
  const lessonWorkspace = lessonWorkspaceCourseEnabled(id)
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
      tabs={teacherCourseTabs(id, publishingQueue.count)}
    >
      <div className="space-y-4">
        {showSetupGuide && (
          <GuideTourMount
            tourId="teacher-course"
            steps={tourById("teacher-course").steps}
            markSeen={markGuideTourSeenAction}
          />
        )}
        {!hasTimetable && <TimetableSetupHint courseId={id} />}
        <PublishingQueueBanner
          courseId={id}
          count={publishingQueue.count}
          next={publishingQueue.next}
        />
        <div className="flex items-center justify-end">
          <UnifiedComposer
            courseId={id}
            lessonOptions={lessonOptions}
            requireLesson={lessonWorkspaceCourseMutationsEnabled(id)}
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
