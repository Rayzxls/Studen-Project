import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Megaphone, Link as LinkIcon } from "lucide-react";
import { assert } from "@/lib/auth/guards";
import { getCourseOfferingForStudent } from "@/lib/course/queries";
import { db } from "@/lib/db/client";
import { formatThaiDateShort } from "@/lib/attendance/format";
import { CourseShell } from "@/components/course/course-shell";
import { studentCourseTabs } from "../_tabs";

/**
 * Student Announcements tab — Phase 7 · P7-8. Read-only mirror.
 * Title is nullable on Announcement; falls back to body excerpt.
 */

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

const EXCERPT_MAX = 80;
function excerpt(s: string): string {
  if (s.length <= EXCERPT_MAX) return s;
  return s.slice(0, EXCERPT_MAX - 1) + "…";
}

export default async function StudentAnnouncementsListPage({
  params,
}: PageProps) {
  const { id } = await params;

  let guard;
  try {
    guard = await assert.isActiveCourseMember(id);
  } catch {
    redirect("/dashboard");
  }

  const course = await getCourseOfferingForStudent(id, guard.session.user.id);
  if (!course) notFound();

  const announcements = await db.announcement.findMany({
    where: { courseOfferingId: id, deletedAt: null },
    select: {
      id: true,
      title: true,
      body: true,
      postedAt: true,
      linkUrls: true,
    },
    orderBy: [{ postedAt: "desc" }, { id: "desc" }],
  });

  return (
    <CourseShell
      session={guard.session}
      course={course}
      eyebrow="ห้องเรียน"
      backHref="/dashboard"
      tabs={studentCourseTabs(id)}
    >
      <div className="card p-6">
        <div className="mb-4">
          <h2
            className="text-lg font-medium text-black"
            style={{ letterSpacing: "-0.02em" }}
          >
            ประกาศ
          </h2>
          <p className="mt-0.5 text-xs text-black/50">
            {announcements.length === 0
              ? "ยังไม่มีประกาศ"
              : `${announcements.length} รายการ`}
          </p>
        </div>

        {announcements.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/15 p-8 text-center">
            <Megaphone className="mx-auto h-7 w-7 text-black/30" />
            <p className="mt-3 text-sm text-black/60">ยังไม่มีประกาศ</p>
            <p className="mt-1 text-xs text-black/40">ครูจะโพสต์ประกาศที่นี่</p>
          </div>
        ) : (
          <ul className="divide-y divide-black/5">
            {announcements.map((a) => {
              const headline = a.title?.trim() ? a.title : excerpt(a.body);
              const linkCount = Array.isArray(a.linkUrls)
                ? a.linkUrls.length
                : 0;
              return (
                <li key={a.id}>
                  <Link
                    href={`/student/courses/${id}/announcements/${a.id}`}
                    className="flex items-start justify-between gap-3 py-3 transition-colors hover:bg-black/[0.02]"
                  >
                    <div className="min-w-0 flex-1 px-2">
                      <p className="truncate text-sm font-medium text-black">
                        {headline}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-black/50">
                        <span>
                          โพสต์เมื่อ {formatThaiDateShort(a.postedAt)}
                        </span>
                        {linkCount > 0 && (
                          <span className="inline-flex items-center gap-0.5">
                            <LinkIcon className="h-3 w-3" aria-hidden="true" />
                            {linkCount}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="self-center px-2 text-xs text-black/40">
                      →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </CourseShell>
  );
}
