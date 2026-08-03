import { db } from "@/lib/db/client";
import { Conflict, Forbidden, NotFound, ValidationError } from "@/lib/errors";
import type { ScheduledContentKind } from "@/lib/publishing/schedule";
import { notifyPublishedNow } from "@/lib/publishing/sweep";
import { canReschedule } from "@/lib/publishing/visibility";

/**
 * Moving a post that has not gone live yet (ADR-0046).
 *
 * The composer is the only place a publish time can be set, so a teacher who
 * picked the wrong hour had to delete the post and write it again. This module
 * lets them move it instead — but only while the class has not seen it.
 *
 * A live post is deliberately out of reach. Pushing `publishAt` back into the
 * future would take content away from students who already have it, which is
 * the unpublish this system does not have, and it would be silent besides:
 * `notifiedAt` is already stamped, so the sweep would never announce the
 * second arrival. The window therefore closes the moment the post is visible.
 *
 * Nothing here is audited, and that is the same tiering the rest of this
 * lifecycle uses: the content is pre-publish, so no student record moves.
 * Editing an unpublished announcement is Verbose today for the same reason.
 */

export interface RescheduleCtx {
  actorUserId: string;
}

interface ScheduleTarget {
  courseOfferingId: string;
  teacherId: string;
  publishAt: Date | null;
  notifiedAt: Date | null;
}

/**
 * Moves a scheduled post to another future time.
 *
 * A time that is not in the future is refused rather than quietly treated as
 * now, because "publish now" is a separate decision with a separate button and
 * a notification attached to it.
 */
export async function reschedulePublishAt(
  kind: ScheduledContentKind,
  id: string,
  publishAt: Date,
  ctx: RescheduleCtx,
  now: Date = new Date()
): Promise<{ courseOfferingId: string }> {
  const target = await assertMovable(kind, id, ctx, now);

  if (Number.isNaN(publishAt.getTime())) {
    throw new ValidationError({ publishAt: "invalid_publish_at" });
  }
  if (publishAt.getTime() <= now.getTime()) {
    throw new ValidationError({ publishAt: "publish_at_must_be_future" });
  }

  await commit(kind, id, publishAt, now);
  return { courseOfferingId: target.courseOfferingId };
}

/**
 * Publishes a scheduled post immediately and tells the class straight away.
 *
 * Visibility comes from the timestamp alone, so the write is what makes the
 * post live; the fan-out that follows only saves the class from waiting for
 * the next sweep. If it fails, the row stays unclaimed and the sweep picks it
 * up — a late nudge, never hidden coursework.
 */
export async function publishScheduledNow(
  kind: ScheduledContentKind,
  id: string,
  ctx: RescheduleCtx,
  now: Date = new Date()
): Promise<{ courseOfferingId: string }> {
  const target = await assertMovable(kind, id, ctx, now);

  await commit(kind, id, now, now);
  await notifyPublishedNow(kind, id, now);
  return { courseOfferingId: target.courseOfferingId };
}

/** Ownership and window checks, before any write. */
async function assertMovable(
  kind: ScheduledContentKind,
  id: string,
  ctx: RescheduleCtx,
  now: Date
): Promise<ScheduleTarget> {
  const target = await loadTarget(kind, id);
  if (!target) throw new NotFound("scheduled_content_not_found");
  if (target.teacherId !== ctx.actorUserId) {
    throw new Forbidden("not_course_owner");
  }
  if (!canReschedule(target, now)) {
    throw new Conflict("already_published");
  }
  return target;
}

async function loadTarget(
  kind: ScheduledContentKind,
  id: string
): Promise<ScheduleTarget | null> {
  if (kind === "ANNOUNCEMENT") {
    const row = await db.announcement.findFirst({
      where: { id, deletedAt: null },
      select: {
        courseOfferingId: true,
        publishAt: true,
        notifiedAt: true,
        course: { select: { teacherId: true } },
      },
    });
    return row ? flatten(row) : null;
  }

  if (kind === "MATERIAL") {
    const row = await db.material.findFirst({
      where: { id, deletedAt: null },
      select: {
        courseOfferingId: true,
        publishAt: true,
        notifiedAt: true,
        course: { select: { teacherId: true } },
      },
    });
    return row ? flatten(row) : null;
  }

  const row = await db.assignment.findUnique({
    where: { id },
    select: {
      courseOfferingId: true,
      publishAt: true,
      notifiedAt: true,
      course: { select: { teacherId: true } },
    },
  });
  return row ? flatten(row) : null;
}

function flatten(row: {
  courseOfferingId: string;
  publishAt: Date | null;
  notifiedAt: Date | null;
  course: { teacherId: string };
}): ScheduleTarget {
  return {
    courseOfferingId: row.courseOfferingId,
    publishAt: row.publishAt,
    notifiedAt: row.notifiedAt,
    teacherId: row.course.teacherId,
  };
}

/**
 * Writes the new time, re-stating the window in the filter.
 *
 * The check above can go stale between the read and the write — the post's
 * moment can arrive in that gap, or a sweep can claim it — so the conditions
 * are repeated here where they are atomic, in the same spirit as the sweep's
 * own claim. Zero rows updated means the post went live first.
 */
async function commit(
  kind: ScheduledContentKind,
  id: string,
  publishAt: Date,
  now: Date
): Promise<void> {
  const where = { id, notifiedAt: null, publishAt: { gt: now } };
  const data = { publishAt };
  const { count } =
    kind === "ANNOUNCEMENT"
      ? await db.announcement.updateMany({ where, data })
      : kind === "MATERIAL"
        ? await db.material.updateMany({ where, data })
        : await db.assignment.updateMany({ where, data });
  if (count !== 1) throw new Conflict("already_published");
}
