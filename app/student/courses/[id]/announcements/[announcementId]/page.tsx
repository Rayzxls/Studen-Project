import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { assert } from "@/lib/auth/guards";
import { getCourseOfferingForStudent } from "@/lib/course/queries";
import { db } from "@/lib/db/client";
import { getOrderedAttachments } from "@/lib/storage/attachments";
import { CourseShell } from "@/components/course/course-shell";
import { PostDetail } from "@/components/course/post-detail";
import { CommentsThread } from "@/components/comment/comments-thread";
import { studentCourseTabs } from "../../_tabs";

/**
 * Student Announcement detail — Phase 7 · P7-8.
 *
 * Read-only mirror with CLASS_WIDE comments thread (same one teacher
 * sees on /teacher/courses/.../announcements/[aid]). Files/images/links
 * render via the shared PostDetail (same component vocabulary as the feed).
 */

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string; announcementId: string }>;
}

export default async function StudentAnnouncementDetailPage({
  params,
}: PageProps) {
  const { id, announcementId } = await params;

  let guard;
  try {
    guard = await assert.isActiveCourseMember(id);
  } catch {
    redirect("/dashboard");
  }

  const course = await getCourseOfferingForStudent(id, guard.session.user.id);
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
      fileAttachmentIds: true,
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
  const attachments = await getOrderedAttachments(
    announcement.fileAttachmentIds
  );

  const posterName = announcement.postedBy.teacher
    ? `${announcement.postedBy.teacher.firstName} ${announcement.postedBy.teacher.lastName}`
    : "ครู";

  return (
    <CourseShell
      session={guard.session}
      course={course}
      eyebrow="ห้องเรียน"
      backHref="/dashboard"
      tabs={studentCourseTabs(id)}
    >
      <div className="space-y-4">
        <Link
          href={`/student/courses/${id}/announcements`}
          className="inline-flex items-center gap-1 text-xs text-black/60 hover:text-black"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          กลับไปรายการประกาศ
        </Link>

        <PostDetail
          kind="ANNOUNCEMENT"
          title={announcement.title}
          emptyTitle="ประกาศไม่มีหัวข้อ"
          body={announcement.body}
          posterName={posterName}
          postedAt={announcement.postedAt}
          attachments={attachments}
          linkUrls={linkUrls}
        />

        <CommentsThread
          ownerType="ANNOUNCEMENT"
          ownerId={announcement.id}
          courseOfferingId={id}
          scope="CLASS_WIDE"
          session={guard.session}
        />
      </div>
    </CourseShell>
  );
}
