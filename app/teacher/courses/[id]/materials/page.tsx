import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BookOpen, Link as LinkIcon } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { db } from "@/lib/db/client";
import { formatThaiDateShort } from "@/lib/attendance/format";
import { CourseShell } from "@/components/course/course-shell";
import { CreateMaterialDialog } from "@/components/material/create-material-dialog";
import { teacherCourseTabs } from "../_tabs";

/**
 * Teacher Materials tab — Phase 7 · P7-7.
 *
 * Lists active (non-soft-deleted) Materials of the CourseOffering ordered
 * by postedAt DESC. Per-row preview shows title + posted date + linkUrls
 * count.
 *
 * Edit + delete affordances live on the per-Material detail page (Q2 = A
 * lock). The list is intentionally compact — class-wide threads can grow
 * long and the list would become unwieldy if expanded inline.
 */

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TeacherMaterialsListPage({ params }: PageProps) {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;
  const course = await getCourseOfferingForTeacher(id, session.user.id);
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
              เอกสารประกอบ
            </h2>
            <p className="mt-0.5 text-xs text-black/50">
              {materials.length === 0
                ? "ยังไม่มีเอกสาร"
                : `${materials.length} รายการ`}
            </p>
          </div>
          <CreateMaterialDialog courseId={id} />
        </div>

        {materials.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/15 p-8 text-center">
            <BookOpen className="mx-auto h-7 w-7 text-black/30" />
            <p className="mt-3 text-sm text-black/60">
              ยังไม่มีเอกสารในวิชานี้
            </p>
            <p className="mt-1 text-xs text-black/40">
              กด &quot;เพิ่มเอกสาร&quot; เพื่อสร้างรายการแรก
            </p>
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
                    href={`/teacher/courses/${id}/materials/${m.id}`}
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
