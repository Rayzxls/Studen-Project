import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { db } from "@/lib/db/client";
import { getOrderedAttachments } from "@/lib/storage/attachments";
import { getModerationRestriction } from "@/lib/moderation/queries";
import { CourseShell } from "@/components/course/course-shell";
import { PostDetail } from "@/components/course/post-detail";
import { EditMaterialDialog } from "@/components/material/edit-material-dialog";
import { DeleteMaterialDialog } from "@/components/material/delete-material-dialog";
import { CommentsThread } from "@/components/comment/comments-thread";
import { teacherCourseTabs } from "../../_tabs";

/**
 * Teacher Material detail — Phase 7 · P7-7.
 *
 * Title + body + linkUrls + file/image attachments + edit/delete, via the
 * shared PostDetail (same vocabulary as the feed). Soft-deleted Materials
 * 404; the owner check up-front gives a clean 404 vs 403 split.
 */

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string; materialId: string }>;
}

export default async function TeacherMaterialDetailPage({ params }: PageProps) {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const { id, materialId } = await params;
  const course = await getCourseOfferingForTeacher(id, session.user.id);
  if (!course) notFound();

  const material = await db.material.findFirst({
    where: {
      id: materialId,
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
        select: { teacher: { select: { firstName: true, lastName: true } } },
      },
    },
  });
  if (!material) notFound();
  if (await getModerationRestriction("MATERIAL", material.id)) notFound();

  const linkUrls = (
    Array.isArray(material.linkUrls) ? material.linkUrls : []
  ) as string[];
  const attachments = await getOrderedAttachments(material.fileAttachmentIds);

  const posterName = material.postedBy.teacher
    ? `${material.postedBy.teacher.firstName} ${material.postedBy.teacher.lastName}`
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
          href={`/teacher/courses/${id}/materials`}
          className="inline-flex items-center gap-1 text-xs text-black/60 hover:text-black"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          กลับไปรายการเอกสาร
        </Link>

        <PostDetail
          kind="MATERIAL"
          title={material.title}
          emptyTitle="เอกสารไม่มีชื่อ"
          body={material.body}
          posterName={posterName}
          postedAt={material.postedAt}
          attachments={attachments}
          linkUrls={linkUrls}
          actions={
            <>
              <EditMaterialDialog
                courseId={id}
                materialId={material.id}
                initialTitle={material.title}
                initialBody={material.body}
                initialLinkUrls={linkUrls}
              />
              <DeleteMaterialDialog courseId={id} materialId={material.id} />
            </>
          }
        />

        <CommentsThread
          ownerType="MATERIAL"
          ownerId={material.id}
          courseOfferingId={id}
          scope="CLASS_WIDE"
          session={session}
        />
      </div>
    </CourseShell>
  );
}
