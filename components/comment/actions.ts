"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/guards";
import {
  createComment,
  editComment,
  selfDeleteComment,
  moderateDeleteComment,
} from "@/lib/assignment/comment";
import { getRequestMeta } from "@/lib/utils/request";
import { HttpError, ValidationError } from "@/lib/errors";
import type { CommentOwnerType, CommentScope } from "@prisma/client";

/**
 * Server Actions for the shared CommentsThread component — Phase 7 · P7-8.
 *
 * Pattern 6 (hidden form fields, no `.bind()`) + Pattern 8 ("use server"
 * = async exports only). Each action calls a lib function and re-
 * validates the calling detail page so the Server Component re-fetches
 * the updated thread.
 *
 * The `revalidatePath` target is reconstructed from a hidden form
 * field rather than `next/headers().pathname` (Next 16 server actions
 * don't have a stable referer hook). The caller is responsible for
 * passing the absolute path the form was submitted from.
 */

export type CommentActionState = {
  fieldErrors?: Record<string, string>;
  error?: string;
  ok?: boolean;
};

export async function createCommentAction(
  _prev: CommentActionState,
  formData: FormData
): Promise<CommentActionState> {
  const session = await requireAuth();
  const meta = await getRequestMeta();

  const ownerType = String(formData.get("ownerType") ?? "") as CommentOwnerType;
  const ownerId = String(formData.get("ownerId") ?? "");
  const scope = String(formData.get("scope") ?? "") as CommentScope;
  const body = String(formData.get("body") ?? "");
  const revalidate = String(formData.get("revalidate") ?? "");

  if (!ownerType || !ownerId || !scope) return { error: "missing_fields" };

  try {
    await createComment(
      { ownerType, ownerId, scope, body },
      {
        actorUserId: session.user.id,
        actorRole: session.user.role,
        ipAddress: meta.ipAddress ?? undefined,
        userAgent: meta.userAgent ?? undefined,
      }
    );
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }

  if (revalidate) revalidatePath(revalidate);
  return { ok: true };
}

export async function editCommentAction(
  _prev: CommentActionState,
  formData: FormData
): Promise<CommentActionState> {
  const session = await requireAuth();
  const meta = await getRequestMeta();

  const commentId = String(formData.get("commentId") ?? "");
  const body = String(formData.get("body") ?? "");
  const revalidate = String(formData.get("revalidate") ?? "");
  if (!commentId) return { error: "missing_comment_id" };

  try {
    await editComment(
      { commentId, body },
      {
        actorUserId: session.user.id,
        actorRole: session.user.role,
        ipAddress: meta.ipAddress ?? undefined,
        userAgent: meta.userAgent ?? undefined,
      }
    );
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }

  if (revalidate) revalidatePath(revalidate);
  return { ok: true };
}

export async function selfDeleteCommentAction(
  _prev: CommentActionState,
  formData: FormData
): Promise<CommentActionState> {
  const session = await requireAuth();
  const meta = await getRequestMeta();

  const commentId = String(formData.get("commentId") ?? "");
  const revalidate = String(formData.get("revalidate") ?? "");
  if (!commentId) return { error: "missing_comment_id" };

  try {
    await selfDeleteComment(commentId, {
      actorUserId: session.user.id,
      actorRole: session.user.role,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
  } catch (err) {
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }

  if (revalidate) revalidatePath(revalidate);
  return { ok: true };
}

export async function moderateDeleteCommentAction(
  _prev: CommentActionState,
  formData: FormData
): Promise<CommentActionState> {
  const session = await requireAuth();
  const meta = await getRequestMeta();

  const commentId = String(formData.get("commentId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const revalidate = String(formData.get("revalidate") ?? "");
  if (!commentId) return { error: "missing_comment_id" };

  try {
    await moderateDeleteComment(
      { commentId, reason },
      {
        actorUserId: session.user.id,
        actorRole: session.user.role,
        ipAddress: meta.ipAddress ?? undefined,
        userAgent: meta.userAgent ?? undefined,
      }
    );
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.errors };
    if (err instanceof HttpError) return { error: err.message };
    throw err;
  }

  if (revalidate) revalidatePath(revalidate);
  return { ok: true };
}
