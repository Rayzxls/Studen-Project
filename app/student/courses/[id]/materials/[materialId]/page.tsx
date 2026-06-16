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
 * Student Material detail — Phase 7 · P7-8.
 *
 * Read-only mirror of teacher Material detail. L1 boundary via
 * `assert.isActiveCourseMember`. Soft-deleted Materials 404. Files/images/
 * links render via the shared PostDetail; hosts the CLASS_WIDE thread.
 */

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string; materialId: string }>;
}

export default async function StudentMaterialDetailPage({ params }: PageProps) {
  const { id, materialId } = await params;

  let guard;
  try {
    guard = await assert.isActiveCourseMember(id);
  } catch {
    redirect("/dashboard");
  }

  const course = await getCourseOfferingForStudent(id, guard.session.user.id);
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
        select: {
          teacher: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!material) notFound();

  const linkUrls = (
    Array.isArray(material.linkUrls) ? material.linkUrls : []
  ) as string[];
  const attachments = await getOrderedAttachments(material.fileAttachmentIds);

  const posterName = material.postedBy.teacher
    ? `${material.postedBy.teacher.firstName} ${material.postedBy.teacher.lastName}`
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
          href={`/student/courses/${id}/materials`}
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
        />

        <CommentsThread
          ownerType="MATERIAL"
          ownerId={material.id}
          courseOfferingId={id}
          scope="CLASS_WIDE"
          session={guard.session}
        />
      </div>
    </CourseShell>
  );
}
