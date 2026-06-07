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
  const page = await getCourseFeed(id, undefined, kindFilter ?? undefined);

  return (
    <CourseShell
      session={guard.session}
      course={course}
      eyebrow="ห้องเรียน"
      backHref="/dashboard"
      tabs={studentCourseTabs(id)}
    >
      <CourseFeedView
        items={page.items}
        courseId={id}
        role="STUDENT"
        filter={filter}
      />
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
