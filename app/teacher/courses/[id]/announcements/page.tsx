import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Megaphone, Link as LinkIcon } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { db } from "@/lib/db/client";
import { formatThaiDateShort } from "@/lib/attendance/format";
import { CourseShell } from "@/components/course/course-shell";
import { CreateAnnouncementDialog } from "@/components/announcement/create-announcement-dialog";
import { teacherCourseTabs } from "../_tabs";

/**
 * Teacher Announcements tab — Phase 7 · P7-7.
 *
 * Lists active (non-soft-deleted) Announcements ordered by postedAt DESC.
 * Per-row shows title (or body excerpt when title is null) + posted date.
 *
 * Announcement vs Material: title is OPTIONAL — when null, we render
 * the first ~80 chars of body as the row headline. Body is REQUIRED so
 * an excerpt is always available.
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

export default async function TeacherAnnouncementsListPage({
  params,
}: PageProps) {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;
  const course = await getCourseOfferingForTeacher(id, session.user.id);
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
      session={session}
      course={course}
      eyebrow="รายวิชาที่สอน"
      backHref="/teacher/courses"
      tabs={teacherCourseTabs(id)}
    >
      <div className="card p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
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
          <CreateAnnouncementDialog courseId={id} />
        </div>

        {announcements.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/15 p-8 text-center">
            <Megaphone className="mx-auto h-7 w-7 text-black/30" />
            <p className="mt-3 text-sm text-black/60">
              ยังไม่มีประกาศในวิชานี้
            </p>
            <p className="mt-1 text-xs text-black/40">
              กด &quot;เพิ่มประกาศ&quot; เพื่อโพสต์ประกาศแรก
            </p>
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
                    href={`/teacher/courses/${id}/announcements/${a.id}`}
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
