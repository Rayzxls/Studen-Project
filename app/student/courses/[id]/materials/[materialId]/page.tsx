import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Link as LinkIcon } from "lucide-react";
import { assert } from "@/lib/auth/guards";
import { getCourseOfferingForStudent } from "@/lib/course/queries";
import { db } from "@/lib/db/client";
import { formatThaiDateShort } from "@/lib/attendance/format";
import { CourseShell } from "@/components/course/course-shell";
import { CommentsThread } from "@/components/comment/comments-thread";
import { SafeExternalLinkButton } from "@/components/link/safe-external-link-button";
import { studentCourseTabs } from "../../_tabs";

/**
 * Student Material detail — Phase 7 · P7-8.
 *
 * Read-only mirror of teacher Material detail. L1 boundary via
 * `assert.isActiveCourseMember`. Soft-deleted Materials 404.
 *
 * Hosts the CLASS_WIDE comments thread (Q1/Q2 = A lock — thread is
 * the same one teacher sees on /teacher/courses/.../materials/[mid]).
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

        <div className="card p-6">
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

          {material.body && (
            <div className="prose prose-sm mt-4 max-w-none whitespace-pre-wrap text-sm text-black/80">
              {material.body}
            </div>
          )}

          {linkUrls.length > 0 && (
            <div className="mt-5 rounded-xl border border-black/[0.06] bg-black/[0.02] p-4">
              <p className="mb-2 text-xs font-medium text-black/60">ลิงก์</p>
              <ul className="space-y-1.5">
                {linkUrls.map((url, i) => (
                  <li key={i}>
                    <SafeExternalLinkButton
                      href={url}
                      className="inline-flex items-center gap-1.5 break-all text-left text-xs text-black hover:underline"
                    >
                      <LinkIcon
                        className="h-3 w-3 shrink-0"
                        aria-hidden="true"
                      />
                      {url}
                    </SafeExternalLinkButton>
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
          session={guard.session}
        />
      </div>
    </CourseShell>
  );
}
