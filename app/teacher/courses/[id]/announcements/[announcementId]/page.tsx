import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { db } from "@/lib/db/client";
import { getOrderedAttachments } from "@/lib/storage/attachments";
import { CourseShell } from "@/components/course/course-shell";
import { PostDetail } from "@/components/course/post-detail";
import { EditAnnouncementDialog } from "@/components/announcement/edit-announcement-dialog";
import { DeleteAnnouncementDialog } from "@/components/announcement/delete-announcement-dialog";
import { CommentsThread } from "@/components/comment/comments-thread";
import { teacherCourseTabs } from "../../_tabs";

/**
 * Teacher Announcement detail — Phase 7 · P7-7.
 *
 * Same shape as Material detail, but Announcement.title is nullable; the
 * shared PostDetail renders the "ประกาศไม่มีหัวข้อ" placeholder and the
 * files/images/links. Edit + Delete sit in the PostDetail actions slot.
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

        <PostDetail
          kind="ANNOUNCEMENT"
          title={announcement.title}
          emptyTitle="ประกาศไม่มีหัวข้อ"
          body={announcement.body}
          posterName={posterName}
          postedAt={announcement.postedAt}
          attachments={attachments}
          linkUrls={linkUrls}
          actions={
            <>
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
            </>
          }
        />

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
