import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { assert } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { CommentsThread } from "@/components/comment/comments-thread";
import { SubmissionFilePreview } from "@/components/assignment/submission-file-preview";

/**
 * Teacher per-submission detail — Phase 9 · P9-2
 *
 * Per-Submission read view + PRIVATE thread between this teacher and
 * the student who owns the submission. The teacher's RETURN dialog
 * already lands an initial PRIVATE comment via `returnSubmission`;
 * this page is where they continue the conversation after that
 * initial reply.
 *
 * Authz piggybacks on `assert.canMutateAssignment` because the
 * teacher who owns the assignment is the only non-student who is
 * authorised to view the PRIVATE thread (CONTEXT § Comment Scope).
 * No extra dispatch needed.
 */

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    id: string;
    assignmentId: string;
    submissionId: string;
  }>;
}

export default async function TeacherSubmissionDetailPage({
  params,
}: PageProps) {
  const { id: courseId, assignmentId, submissionId } = await params;

  let session;
  try {
    const result = await assert.canMutateAssignment(assignmentId);
    session = result.session;
    if (result.assignment.courseOfferingId !== courseId) notFound();
  } catch {
    redirect("/dashboard");
  }

  const submission = await db.submission.findFirst({
    where: { id: submissionId, assignmentId },
    select: {
      id: true,
      status: true,
      enrollment: {
        select: {
          student: {
            select: { firstName: true, lastName: true, studentId: true },
          },
        },
      },
      versions: {
        orderBy: { versionNumber: "desc" },
        select: {
          id: true,
          versionNumber: true,
          isCurrent: true,
          isLate: true,
          submittedAt: true,
          textContent: true,
          links: true,
          fileAttachmentIds: true,
        },
      },
    },
  });
  if (!submission) notFound();

  const fileIds = new Set<string>();
  for (const version of submission.versions) {
    for (const fileId of (version.fileAttachmentIds as string[] | null) ?? []) {
      fileIds.add(fileId);
    }
  }
  const files =
    fileIds.size > 0
      ? await db.fileAttachment.findMany({
          where: { id: { in: Array.from(fileIds) }, deletedAt: null },
          select: {
            id: true,
            originalFilename: true,
            sizeBytes: true,
            mimeType: true,
          },
        })
      : [];
  const fileById = new Map(files.map((file) => [file.id, file]));

  const fullName = `${submission.enrollment.student.firstName} ${submission.enrollment.student.lastName}`;

  const dateFmt = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link
        href={`/teacher/courses/${courseId}/assignments/${assignmentId}`}
        className="inline-flex items-center gap-1 text-xs text-black/50 hover:text-black"
      >
        <ChevronLeft className="h-3 w-3" /> กลับไปยังการบ้าน
      </Link>

      <div className="card mt-3 p-6">
        <h1 className="text-lg font-medium text-black">{fullName}</h1>
        <p className="mt-1 text-xs text-black/50">
          เลขประจำตัว {submission.enrollment.student.studentId} ·{" "}
          <code className="text-[11px]">{submission.status}</code>
        </p>
      </div>

      {submission.versions.length > 0 && (
        <div className="card mt-4 p-6">
          <h2 className="text-sm font-medium text-black">ประวัติการส่ง</h2>
          <ul className="mt-3 space-y-3">
            {submission.versions.map((v) => (
              <li
                key={v.id}
                className={`rounded-lg border p-3 ${
                  v.isCurrent
                    ? "border-green-200 bg-green-50/40"
                    : "border-black/10 bg-black/[0.02]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-black">
                    เวอร์ชัน {v.versionNumber}
                    {v.isCurrent && (
                      <span className="ml-2 text-[10px] text-green-700">
                        (ปัจจุบัน)
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-black/40">
                    {dateFmt.format(v.submittedAt)}
                    {v.isLate && (
                      <span className="ml-2 rounded bg-orange-100 px-1 text-[9px] text-orange-700">
                        ส่งสาย
                      </span>
                    )}
                  </p>
                </div>
                {v.textContent && (
                  <p className="mt-2 whitespace-pre-wrap text-xs text-black/70">
                    {v.textContent}
                  </p>
                )}
                {Array.isArray(v.links) && v.links.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {(v.links as string[]).map((href, i) => (
                      <li
                        key={i}
                        className="text-[11px] text-blue-700 hover:underline"
                      >
                        <a href={href} target="_blank" rel="noreferrer">
                          {href}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                {((v.fileAttachmentIds as string[] | null) ?? []).length >
                  0 && (
                  <SubmissionFilePreview
                    files={((v.fileAttachmentIds as string[] | null) ?? [])
                      .map((fileId) => fileById.get(fileId))
                      .filter((file): file is NonNullable<typeof file> =>
                        Boolean(file)
                      )}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <CommentsThread
          ownerType="SUBMISSION"
          ownerId={submission.id}
          courseOfferingId={courseId}
          scope="PRIVATE"
          session={session}
          revalidatePath={`/teacher/courses/${courseId}/assignments/${assignmentId}/submissions/${submission.id}`}
        />
      </div>
    </div>
  );
}
