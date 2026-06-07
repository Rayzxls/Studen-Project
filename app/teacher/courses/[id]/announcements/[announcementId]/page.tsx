import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Link as LinkIcon } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { db } from "@/lib/db/client";
import { formatThaiDateShort } from "@/lib/attendance/format";
import { CourseShell } from "@/components/course/course-shell";
import { EditAnnouncementDialog } from "@/components/announcement/edit-announcement-dialog";
import { DeleteAnnouncementDialog } from "@/components/announcement/delete-announcement-dialog";
import { CommentsThread } from "@/components/comment/comments-thread";
import { teacherCourseTabs } from "../../_tabs";

/**
 * Teacher Announcement detail — Phase 7 · P7-7.
 *
 * Same shape as Material detail, but Announcement.title is nullable;
 * the page falls back to "ประกาศไม่มีหัวข้อ" placeholder when title
 * is empty. Comments thread is deferred to P7-8 (Q3 = B lock).
 */

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string; announcementId: string }>;
}

export default async function TeacherAnnouncementDetailPage({
  params,
}: PageProps) {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const { id, announcementId } = await params;
  const course = await getCourseOfferingForTeacher(id, session.user.id);
  if (!course) notFound();

  const announcement = await db.announcement.findFirst({
    where: {
      id: announcementId,
      courseOfferingId: id,
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      body: true,
      linkUrls: true,
      postedAt: true,
      postedBy: {
        select: {
          teacher: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!announcement) notFound();

  const linkUrls = (
    Array.isArray(announcement.linkUrls) ? announcement.linkUrls : []
  ) as string[];

  const posterName = announcement.postedBy.teacher
    ? `${announcement.postedBy.teacher.firstName} ${announcement.postedBy.teacher.lastName}`
    : "ครู";

  const headline = announcement.title?.trim() || "ประกาศไม่มีหัวข้อ";

  return (
    <CourseShell
      session={session}
      course={course}
      eyebrow="รายวิชาที่สอน"
      backHref="/teacher/courses"
      tabs={teacherCourseTabs(id)}
    >
      <div className="space-y-4">
        <Link
          href={`/teacher/courses/${id}/announcements`}
          className="inline-flex items-center gap-1 text-xs text-black/60 hover:text-black"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          กลับไปรายการประกาศ
        </Link>

        <div className="card p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1
                className={`text-2xl font-medium md:text-3xl ${
                  announcement.title?.trim() ? "text-black" : "text-black/50"
                }`}
                style={{ letterSpacing: "-0.02em" }}
              >
                {headline}
              </h1>
              <p className="mt-1 text-xs text-black/50">
                โดย {posterName} · โพสต์เมื่อ{" "}
                {formatThaiDateShort(announcement.postedAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <EditAnnouncementDialog
                courseId={id}
                announcementId={announcement.id}
                initialTitle={announcement.title}
                initialBody={announcement.body}
                initialLinkUrls={linkUrls}
              />
              <DeleteAnnouncementDialog
                courseId={id}
                announcementId={announcement.id}
              />
            </div>
          </div>

          <div className="prose prose-sm mt-2 max-w-none whitespace-pre-wrap text-sm text-black/80">
            {announcement.body}
          </div>

          {linkUrls.length > 0 && (
            <div className="mt-5 rounded-xl border border-black/[0.06] bg-black/[0.02] p-4">
              <p className="mb-2 text-xs font-medium text-black/60">ลิงก์</p>
              <ul className="space-y-1.5">
                {linkUrls.map((url, i) => (
                  <li key={i}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 break-all text-xs text-black hover:underline"
                    >
                      <LinkIcon
                        className="h-3 w-3 shrink-0"
                        aria-hidden="true"
                      />
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <CommentsThread
          ownerType="ANNOUNCEMENT"
          ownerId={announcement.id}
          courseOfferingId={id}
          scope="CLASS_WIDE"
          session={session}
        />
      </div>
    </CourseShell>
  );
}
