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
  revalidatePath: revalidateOverride,
  title = "ความคิดเห็น",
  emptyText = "ยังไม่มีความคิดเห็น เป็นคนแรกที่ตอบ",
  variant = "default",
}: {
  ownerType: CommentOwnerType;
  ownerId: string;
  courseOfferingId: string;
  scope: CommentScope;
  session: Session;
  title?: string;
  emptyText?: string;
  variant?: "default" | "social";
  /**
   * Optional override for the path the actions revalidate after a
   * mutation. SUBMISSION threads pass this because the per-submission
   * URL depends on the parent Assignment id that the thread does not
   * know on its own (P9-2).
   */
  revalidatePath?: string;
}) {
  // Resolve which path the parent page lives at so server actions can
  // revalidate it. We reconstruct from ownerType + ids rather than
  // accepting a free-form path because callers compose URLs the same
  // way and the role split is fixed (teacher vs student).
  const role = session.user.role;
  const rolePrefix = role === "TEACHER" ? "teacher" : "student";
  const revalidate =
    revalidateOverride ??
    ownerTypeToPath(rolePrefix, courseOfferingId, ownerType, ownerId);

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
  const isSocial = variant === "social";

  return (
    <section
      className={
        isSocial
          ? "overflow-hidden rounded-[28px] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.04]"
          : "card p-6"
      }
    >
      {isSocial && <div className="h-1.5 bg-blue-500" />}
      <div
        className={
          isSocial
            ? "flex items-center gap-3 px-5 pb-4 pt-5 sm:px-6"
            : "mb-4 flex items-center gap-2"
        }
      >
        <span
          className={
            isSocial
              ? "grid h-10 w-10 place-items-center rounded-full bg-blue-500 p-[2px]"
              : ""
          }
        >
          <span
            className={
              isSocial
                ? "grid h-full w-full place-items-center rounded-full bg-white"
                : ""
            }
          >
            <MessageSquare
              className={
                isSocial ? "h-4 w-4 text-[#0a84ff]" : "h-4 w-4 text-black/40"
              }
              aria-hidden="true"
            />
          </span>
        </span>
        <h2
          className={
            isSocial
              ? "text-lg font-semibold text-black"
              : "text-base font-medium text-black"
          }
          style={{ letterSpacing: "-0.01em" }}
        >
          {title}
        </h2>
        <span
          className={
            isSocial
              ? "rounded-full bg-black/[0.04] px-2 py-0.5 text-xs font-medium text-black/45"
              : "text-xs text-black/40"
          }
        >
          {aliveCount}
        </span>
      </div>

      {comments.length === 0 ? (
        <p
          className={
            isSocial
              ? "mx-5 rounded-[22px] border border-dashed border-black/10 bg-gradient-to-br from-[#eef7fc] to-[#eff0fe] p-8 text-center text-sm text-black/45 sm:mx-6"
              : "rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-black/50"
          }
        >
          {emptyText}
        </p>
      ) : (
        <ul
          className={
            isSocial ? "space-y-3 px-5 sm:px-6" : "divide-y divide-black/5"
          }
        >
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
              <li
                key={c.id}
                className={
                  isSocial
                    ? "rounded-[24px] bg-gradient-to-br from-black/[0.025] to-black/[0.01] p-3"
                    : "py-3"
                }
              >
                <div className="flex items-start justify-between gap-3">
                  {isSocial && (
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-500 text-xs font-semibold text-white">
                      {authorName.trim().slice(0, 1)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-xs text-black/60">
                      <span className="font-medium text-black">
                        {authorName}
                      </span>
                      {roleBadge && (
                        <span
                          className={
                            isSocial
                              ? "rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700"
                              : "rounded bg-black/[0.05] px-1.5 py-0.5 text-[10px] text-black/60"
                          }
                        >
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
                      <p
                        className={
                          isSocial
                            ? "mt-1 whitespace-pre-wrap break-words text-[15px] leading-6 text-black/80"
                            : "mt-1 whitespace-pre-wrap break-words text-sm text-black/80"
                        }
                      >
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
        variant={variant}
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
