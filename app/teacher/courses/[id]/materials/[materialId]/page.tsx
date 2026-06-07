import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Link as LinkIcon } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { db } from "@/lib/db/client";
import { formatThaiDateShort } from "@/lib/attendance/format";
import { CourseShell } from "@/components/course/course-shell";
import { EditMaterialDialog } from "@/components/material/edit-material-dialog";
import { DeleteMaterialDialog } from "@/components/material/delete-material-dialog";
import { CommentsThread } from "@/components/comment/comments-thread";
import { teacherCourseTabs } from "../../_tabs";

/**
 * Teacher Material detail — Phase 7 · P7-7.
 *
 * Shows title + body + linkUrls + attachments + edit/delete affordances.
 * Comments thread deferred to P7-8 (Q3 = B lock — ship CRUD here, hook
 * up class-wide thread when the student UI lands).
 *
 * Soft-deleted Materials 404 (deletedAt filter inline). The hard rule
 * "course owner only" lives in the Material lib mutations; this page
 * does the owner check up-front for a clean 404 vs 403 split.
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

  const linkUrls = (
    Array.isArray(material.linkUrls) ? material.linkUrls : []
  ) as string[];

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

        <div className="card p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1
                className="text-2xl font-medium text-black md:text-3xl"
                style={{ letterSpacing: "-0.02em" }}
              >
                {material.title}
              </h1>
              <p className="mt-1 text-xs text-black/50">
                โดย {posterName} · โพสต์เมื่อ{" "}
                {formatThaiDateShort(material.postedAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <EditMaterialDialog
                courseId={id}
                materialId={material.id}
                initialTitle={material.title}
                initialBody={material.body}
                initialLinkUrls={linkUrls}
              />
              <DeleteMaterialDialog courseId={id} materialId={material.id} />
            </div>
          </div>

          {material.body && (
            <div className="prose prose-sm mt-2 max-w-none whitespace-pre-wrap text-sm text-black/80">
              {material.body}
            </div>
          )}

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
