import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BookOpen, Link as LinkIcon } from "lucide-react";
import { assert } from "@/lib/auth/guards";
import { getCourseOfferingForStudent } from "@/lib/course/queries";
import { db } from "@/lib/db/client";
import { formatThaiDateShort } from "@/lib/attendance/format";
import { CourseShell } from "@/components/course/course-shell";
import { studentCourseTabs } from "../_tabs";

/**
 * Student Materials tab — Phase 7 · P7-8.
 *
 * Read-only mirror of the teacher Materials list. L1 boundary via
 * `assert.isActiveCourseMember` — removed enrollments cannot reach this
 * route (`removedAt IS NOT NULL` → redirect to dashboard).
 *
 * Soft-deleted Materials are hidden inline via `deletedAt = null`. A
 * cascade-suppressed `MATERIAL_POSTED` notification on the bell would
 * also stop linking here.
 */

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StudentMaterialsListPage({ params }: PageProps) {
  const { id } = await params;

  let guard;
  try {
    guard = await assert.isActiveCourseMember(id);
  } catch {
    redirect("/dashboard");
  }

  const course = await getCourseOfferingForStudent(id, guard.session.user.id);
  if (!course) notFound();

  const materials = await db.material.findMany({
    where: { courseOfferingId: id, deletedAt: null },
    select: {
      id: true,
      title: true,
      postedAt: true,
      linkUrls: true,
      fileAttachmentIds: true,
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
            เอกสารประกอบ
          </h2>
          <p className="mt-0.5 text-xs text-black/50">
            {materials.length === 0
              ? "ยังไม่มีเอกสารในวิชานี้"
              : `${materials.length} รายการ`}
          </p>
        </div>

        {materials.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/15 p-8 text-center">
            <BookOpen className="mx-auto h-7 w-7 text-black/30" />
            <p className="mt-3 text-sm text-black/60">ยังไม่มีเอกสาร</p>
            <p className="mt-1 text-xs text-black/40">ครูจะโพสต์เอกสารที่นี่</p>
          </div>
        ) : (
          <ul className="divide-y divide-black/5">
            {materials.map((m) => {
              const linkCount = Array.isArray(m.linkUrls)
                ? m.linkUrls.length
                : 0;
              const fileCount = Array.isArray(m.fileAttachmentIds)
                ? m.fileAttachmentIds.length
                : 0;
              return (
                <li key={m.id}>
                  <Link
                    href={`/student/courses/${id}/materials/${m.id}`}
                    className="flex items-start justify-between gap-3 py-3 transition-colors hover:bg-black/[0.02]"
                  >
                    <div className="min-w-0 flex-1 px-2">
                      <p className="truncate text-sm font-medium text-black">
                        {m.title}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-black/50">
                        <span>
                          โพสต์เมื่อ {formatThaiDateShort(m.postedAt)}
                        </span>
                        {linkCount > 0 && (
                          <span className="inline-flex items-center gap-0.5">
                            <LinkIcon className="h-3 w-3" aria-hidden="true" />
                            {linkCount}
                          </span>
                        )}
                        {fileCount > 0 && (
                          <span className="text-black/40">
                            · {fileCount} ไฟล์
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
