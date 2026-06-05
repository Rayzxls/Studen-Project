import { MessageSquare } from "lucide-react";
import type { CommentOwnerType, CommentScope } from "@prisma/client";
import type { Session } from "@/lib/auth/permissions";
import { db } from "@/lib/db/client";
import { COMMENT_EDIT_WINDOW_MS } from "@/lib/assignment/constants";
import { formatNotificationTime } from "@/lib/notification/time-format";
import { CommentComposer } from "./composer";
import { EditCommentDialog } from "./edit-comment-dialog";
import { SelfDeleteCommentButton } from "./delete-comment-button";
import { ModerateDeleteCommentDialog } from "./moderate-delete-dialog";

/**
 * Comments thread — Phase 7 · P7-8 (Q1 = A single reusable shape).
 *
 * Server Component reused by Assignment / Material / Announcement
 * detail pages on BOTH the teacher and student sides. Resolves the
 * thread via `(ownerType, ownerId)` and renders:
 *   - chronological comment list (oldest → newest)
 *   - inline composer for the signed-in user
 *   - author-self-edit (5-min window) + author-self-delete
 *   - moderator-delete (Teacher of this course / Admin) with reason
 *
 * Soft-deleted rows render a placeholder ("ข้อความนี้ถูกลบ") so the
 * thread structure stays intact (matches CONTEXT § Comment Moderation).
 *
 * The `session` prop is the caller's resolved session (saves a re-auth
 * inside the component). `revalidate` is the URL the parent page sits
 * at — actions revalidate that path after mutating.
 */
export async function CommentsThread({
  ownerType,
  ownerId,
  courseOfferingId,
  scope,
  session,
}: {
  ownerType: CommentOwnerType;
  ownerId: string;
  courseOfferingId: string;
  scope: CommentScope;
  session: Session;
}) {
  // Resolve which path the parent page lives at so server actions can
  // revalidate it. We reconstruct from ownerType + ids rather than
  // accepting a free-form path because callers compose URLs the same
  // way and the role split is fixed (teacher vs student).
  const role = session.user.role;
  const rolePrefix = role === "TEACHER" ? "teacher" : "student";
  const revalidate = ownerTypeToPath(
    rolePrefix,
    courseOfferingId,
    ownerType,
    ownerId
  );

  const [comments, courseTeacherIdRow] = await Promise.all([
    db.comment.findMany({
      where: { ownerType, ownerId, scope },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        authorId: true,
        body: true,
        createdAt: true,
        editedAt: true,
        deletedAt: true,
        deletedReason: true,
        author: {
          select: {
            role: true,
            teacher: { select: { firstName: true, lastName: true } },
            student: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    db.courseOffering.findUnique({
      where: { id: courseOfferingId },
      select: { teacherId: true },
    }),
  ]);

  const courseTeacherId = courseTeacherIdRow?.teacherId ?? null;
  const isModerator =
    (role === "TEACHER" && session.user.id === courseTeacherId) ||
    role === "ADMIN";

  // Server time once for the "is row still within edit window?" check.
  // Pattern 12 doesn't apply (server-side captured at request time).
   
  const now = new Date();
  const aliveCount = comments.filter((c) => c.deletedAt === null).length;

  return (
    <section className="card p-6">
      <div className="mb-4 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-black/40" aria-hidden="true" />
        <h2
          className="text-base font-medium text-black"
          style={{ letterSpacing: "-0.01em" }}
        >
          ความคิดเห็น
        </h2>
        <span className="text-xs text-black/40">{aliveCount}</span>
      </div>

      {comments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-black/50">
          ยังไม่มีความคิดเห็น เป็นคนแรกที่ตอบ
        </p>
      ) : (
        <ul className="divide-y divide-black/5">
          {comments.map((c) => {
            const isOwn = c.authorId === session.user.id;
            const isAlive = c.deletedAt === null;
            const withinEditWindow =
              isAlive &&
              now.getTime() - c.createdAt.getTime() < COMMENT_EDIT_WINDOW_MS;
            const authorName = c.author.teacher
              ? `${c.author.teacher.firstName} ${c.author.teacher.lastName}`
              : c.author.student
                ? `${c.author.student.firstName} ${c.author.student.lastName}`
                : "ผู้ใช้";
            const roleBadge =
              c.author.role === "TEACHER"
                ? "ครู"
                : c.author.role === "ADMIN"
                  ? "ผู้ดูแล"
                  : null;
            return (
              <li key={c.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-xs text-black/60">
                      <span className="font-medium text-black">
                        {authorName}
                      </span>
                      {roleBadge && (
                        <span className="rounded bg-black/[0.05] px-1.5 py-0.5 text-[10px] text-black/60">
                          {roleBadge}
                        </span>
                      )}
                      <span>·</span>
                      <span>{formatNotificationTime(c.createdAt, now)}</span>
                      {c.editedAt && (
                        <span className="text-black/40">(แก้ไขแล้ว)</span>
                      )}
                    </p>
                    {isAlive ? (
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-black/80">
                        {c.body}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm italic text-black/40">
                        ข้อความนี้ถูกลบ
                        {c.deletedReason && (
                          <span className="ml-1 text-black/30">
                            · {c.deletedReason}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  {isAlive && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      {isOwn && withinEditWindow && (
                        <EditCommentDialog
                          commentId={c.id}
                          initialBody={c.body}
                          revalidate={revalidate}
                        />
                      )}
                      {isOwn && (
                        <SelfDeleteCommentButton
                          commentId={c.id}
                          revalidate={revalidate}
                        />
                      )}
                      {isModerator && !isOwn && (
                        <ModerateDeleteCommentDialog
                          commentId={c.id}
                          revalidate={revalidate}
                        />
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <CommentComposer
        ownerType={ownerType}
        ownerId={ownerId}
        scope={scope}
        revalidate={revalidate}
      />
    </section>
  );
}

function ownerTypeToPath(
  rolePrefix: "teacher" | "student",
  courseId: string,
  ownerType: CommentOwnerType,
  ownerId: string
): string {
  switch (ownerType) {
    case "ASSIGNMENT":
      return `/${rolePrefix}/courses/${courseId}/assignments/${ownerId}`;
    case "MATERIAL":
      return `/${rolePrefix}/courses/${courseId}/materials/${ownerId}`;
    case "ANNOUNCEMENT":
      return `/${rolePrefix}/courses/${courseId}/announcements/${ownerId}`;
    case "SUBMISSION":
      // Submission detail isn't a routable URL pattern — revalidate
      // the assignment list as a coarse fallback. PRIVATE composer is
      // deferred to a later sub-task.
      return `/${rolePrefix}/courses/${courseId}/assignments`;
  }
}
