import { notFound, redirect } from "next/navigation";
import { assert } from "@/lib/auth/guards";
import { getCourseOfferingForStudent } from "@/lib/course/queries";
import { getCourseFeed } from "@/lib/feed/aggregator";
import { CourseShell } from "@/components/course/course-shell";
import {
  CourseFeedView,
  feedKindsForFilter,
  type CourseFeedFilter,
} from "@/components/feed/course-feed-view";
import { GuideTourMount } from "@/components/guide/guide-tour-mount";
import { shouldShowTour } from "@/lib/guide/completion";
import { tourById } from "@/lib/guide/tours";
import { markGuideTourSeenAction } from "@/app/dashboard/guide-actions";
import { studentCourseTabs } from "../_tabs";

// Auth-gated DB-fetching page — skip static prerender.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}

export default async function StudentCourseFeedPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { type } = await searchParams;

  let guard;
  try {
    guard = await assert.isActiveCourseMember(id);
  } catch {
    redirect("/dashboard");
  }

  const course = await getCourseOfferingForStudent(id, guard.session.user.id);
  if (!course) notFound();

  const filter = normalizeFilter(type);
  const kindFilter = feedKindsForFilter(filter);
  const [page, showTour] = await Promise.all([
    getCourseFeed(id, "STUDENT", undefined, kindFilter ?? undefined),
    shouldShowTour({
      userId: guard.session.user.id,
      tourId: "student-course",
      eligible: true,
    }),
  ]);

  return (
    <CourseShell
      session={guard.session}
      course={course}
      eyebrow="ห้องเรียน"
      backHref="/dashboard"
      tabs={studentCourseTabs(id)}
    >
      <div className="space-y-4">
        {showTour && (
          <GuideTourMount
            tourId="student-course"
            steps={tourById("student-course").steps}
            markSeen={markGuideTourSeenAction}
          />
        )}
        <CourseFeedView
          items={page.items}
          courseId={id}
          role="STUDENT"
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
